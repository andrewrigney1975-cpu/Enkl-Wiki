# Build context is the /server directory (see docker-compose.yml), so this
# can restore/publish just the API project without pulling in the test
# project's packages.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY EnklWiki.Api/EnklWiki.Api.csproj EnklWiki.Api/
RUN dotnet restore EnklWiki.Api/EnklWiki.Api.csproj

COPY EnklWiki.Api/ EnklWiki.Api/
RUN dotnet publish EnklWiki.Api/EnklWiki.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "EnklWiki.Api.dll"]
