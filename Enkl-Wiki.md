# Enkl-Wiki App

## Purpose
- 100% client-side Content Management System that runs offline and stores pages as Markdown in JSON
- Designed to run from file:// protocol
- Designed to run from a thumb drive
- Designed to be served from https:// web server
- Content pages and the site's JSON config file can be published to a web server via FTP - this operation is outside the scope of this plan
- Page hierarchy is persisted in localStorage and can be exported and imported as a JSON file
- Single file that combines app style, HTML and JavaScript

## Design
- A Page is a JSON document with a unique identifier and a slug
- A Page has a parent page (nullable for top level pages), a title (simple text, not nullable), body (markdown, not nullable) and a collection of 0 to * tags, prefixed with a # symbol
- Tags are centralised and shared across Pages
- Tags will act as part of the site search function
- A frequency weighted, document length normalised, cosine similarity approach to searching with a threshold match of 15% will be implemented within an inline web worker for fast full-text searching
- Paths to pages are represented with hashbang URLs using the slug so links can be persisted
- Page content is stored on the local filesystem using APIs to fetch a document and to save a document as a download
- Pages will be stored without any filesystem hierarchy. Hierarchy will be logically controlled via the site's page structure in the site JSON file
- There is no limit to the depth or nesting of pages
- The app will have 2 sub-folders - /pages and /uploads
- Editors can upload SVG, PNG, JPG, MP3, MP4 and PDF documents to the uploads sub-folder
- Editors will use Markdown to embed uploaded media into a page
- An instance collects Pages under a site title property
- A Site has a description (markdown)

## Implementation
- Configuration variable that is used to choose or in-memory page content stored in the apps's JSON config file or filesystem-based page content
- A WYSIWYG Markdown editor component will need to be created
- This Markdown editor will save pages to the file system
- This Markdown component will give editors the option to see and modify the underlying raw Markdown
- An SVG-based diagramming component will need to be created
- This drawing tool will be able to export SVG images to the uploads sub-folder
- Diagramming tool will include basic flowchart shapes, along with SVGs for users, pages, databases, API, code and it will allow for straight and curved connectors
- A function to read the config JSON hierarchy and build a logical document structure based on teh hierarchy
- An engine to load pages from the filesystem based on the hashbang and render the Markdown content as valid HTML5, including audio and video tags as necessary based on the file type of an embedded asset
- An export function that will save an HTML formatted page with embedded media to the users local filesystem

## Users
- Visitors can read pages and navigate but cannot see an Edit button nor see any buttons to create images or upload files
- Editors will need to enter a credential/secret key (initially "foobar") in order to edit a page, the hierarchy or upload an asset
- This credential will be hashed securely and held in the site's config JSON file
- Editors will be able to add new Pages, edit existing pages, archive existing pages (hiding them but not removing their entry in the JSON config file) and delete pages (remove from JSON config)
- Page deletions that cause child pages to be orphaned will be handled by asking the user if orphans should also be deleted, the top-most orphan re-pointed to a different parent or the top-most orphan promoted to a top-level page with no parent

## Interface
- Visually structured like https://enkl.app
- Reading a page will happen in the main surface of the app
- Editor operations will happen in large modals
- App icon will be a iconified pencil
- Editors see the left hand tool strip with tools to edit hierarchy or a page
- To the right of the tool strip is the index of pages in a tree list
- Middle pane is the largest and displays the content of the page
- Editors see an additional panel on the right when editing a page that displays a Markdown cheat sheet OR a pages and uploads list via a toggle control in the UI
- The app will use Google Font's "Inter"
- An About modal with app icon and name, version number

## Architecture
- ES6 modules for source files
- HTML5 with modern APIs
- Targeting modern browsers on desktop, tablet and mobile with graceful degradation as needed
- Web workers to perform searching
- jsdom testing
- Feature testing and smoke testing
- Full suite regression testing when asked
- UI elements are inline SVG

## Build Process
- /src folder will hold all the source code
- esbuild will be used to minify CSS, bundle and minify JavaScript and merge them into the HTML file to produce a single file in the /dist folder
- There will be an APP_VERSION variable that will need to have the MINOR version number incremented on build, format is MAJOR.MINOR.YYYYMMDD.HHMM