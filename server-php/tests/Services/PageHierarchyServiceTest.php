<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Services;

use EnklWiki\Services\PageHierarchyService;
use EnklWiki\Tests\TestCase;

final class PageHierarchyServiceTest extends TestCase
{
    /** @dataProvider slugifyExamples */
    public function testSlugifyMatchesClientSideSemantics(string $input, string $expected): void
    {
        self::assertSame($expected, PageHierarchyService::slugify($input));
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function slugifyExamples(): array
    {
        return [
            'basic' => ['Hello World', 'hello-world'],
            'trims' => ['  Trim Me  ', 'trim-me'],
            'accents' => ['Café Déjà Vu', 'cafe-deja-vu'],
            'punctuation only' => ['!!!', ''],
        ];
    }

    public function testUniqueSlugReturnsBaseSlugWhenUnused(): void
    {
        $service = new PageHierarchyService($this->db);
        self::assertSame('hello', $service->uniqueSlug('hello'));
    }

    public function testUniqueSlugAppendsANumberOnCollision(): void
    {
        $this->insertPage('p1', 'hello');
        $this->insertPage('p2', 'hello-2');

        $service = new PageHierarchyService($this->db);
        self::assertSame('hello-3', $service->uniqueSlug('hello'));
    }

    public function testUniqueSlugExcludesThePageBeingRenamedFromTheCollisionCheck(): void
    {
        $this->insertPage('p1', 'hello');

        $service = new PageHierarchyService($this->db);
        self::assertSame('hello', $service->uniqueSlug('hello', excludePageId: 'p1'));
    }

    public function testGetDescendantIdsReturnsChildrenAndGrandchildrenButNotSiblings(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child', 'child', parentId: 'root');
        $this->insertPage('grandchild', 'grandchild', parentId: 'child');
        $this->insertPage('sibling', 'sibling');

        $service = new PageHierarchyService($this->db);
        $descendants = $service->getDescendantIds('root');

        self::assertContains('child', $descendants);
        self::assertContains('grandchild', $descendants);
        self::assertNotContains('sibling', $descendants);
    }

    public function testWouldCreateCycleIsTrueForSelfAndDescendants(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child', 'child', parentId: 'root');

        $service = new PageHierarchyService($this->db);
        self::assertTrue($service->wouldCreateCycle('root', 'root'));
        self::assertTrue($service->wouldCreateCycle('root', 'child'));
        self::assertFalse($service->wouldCreateCycle('child', 'root'));
    }

    public function testMoveSiblingSwapsSortOrderWithThePreviousSiblingAndIsANoopAtTheStart(): void
    {
        $this->insertPage('a', 'a', sortOrder: 0);
        $this->insertPage('b', 'b', sortOrder: 1);
        $this->insertPage('c', 'c', sortOrder: 2);

        $service = new PageHierarchyService($this->db);
        $service->moveSibling('b', 'up');

        self::assertSame(1, $this->sortOrderOf('a'));
        self::assertSame(0, $this->sortOrderOf('b'));

        $service->moveSibling('b', 'up'); // now at the front — no-op
        self::assertSame(0, $this->sortOrderOf('b'));
    }

    public function testDeletePageWithChildrenCascadeRemovesThePageAndAllDescendants(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child', 'child', parentId: 'root');
        $this->insertPage('grandchild', 'grandchild', parentId: 'child');

        (new PageHierarchyService($this->db))->deletePageWithChildren('root', 'cascade', null);

        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM pages')->fetchColumn());
    }

    public function testDeletePageWithChildrenPromoteMakesTheTopMostChildTopLevelAndNestsTheRestUnderIt(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child1', 'child1', parentId: 'root', sortOrder: 0);
        $this->insertPage('child2', 'child2', parentId: 'root', sortOrder: 1);

        (new PageHierarchyService($this->db))->deletePageWithChildren('root', 'promote', null);

        self::assertNull($this->parentIdOf('child1'));
        self::assertSame('child1', $this->parentIdOf('child2'));
        self::assertSame(0, (int) $this->db->query("SELECT COUNT(*) FROM pages WHERE id = 'root'")->fetchColumn());
    }

    public function testDeletePageWithChildrenRepointReparentsTheTopMostChildToTheGivenParent(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('elsewhere', 'elsewhere');
        $this->insertPage('child1', 'child1', parentId: 'root', sortOrder: 0);

        (new PageHierarchyService($this->db))->deletePageWithChildren('root', 'repoint', 'elsewhere');

        self::assertSame('elsewhere', $this->parentIdOf('child1'));
    }

    private function sortOrderOf(string $id): int
    {
        $stmt = $this->db->prepare('SELECT sort_order FROM pages WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return (int) $stmt->fetchColumn();
    }

    private function parentIdOf(string $id): ?string
    {
        $stmt = $this->db->prepare('SELECT parent_id FROM pages WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $value = $stmt->fetchColumn();
        return $value === false || $value === null ? null : (string) $value;
    }
}
