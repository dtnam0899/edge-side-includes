# syntax=docker/dockerfile:1
# Stages: restore -> test (format check, build, unit tests; CI target) -> integration-test (run by compose)
#         -> publish -> runtime; bundle -> migrator (applies EF Core migrations to the app database).
FROM mcr.microsoft.com/dotnet/sdk:10.0.402-noble AS restore
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props Esi.Core.slnx ./
COPY .config/dotnet-tools.json .config/
COPY src/Esi.Core.Api/*.csproj src/Esi.Core.Api/packages.lock.json src/Esi.Core.Api/
COPY src/Esi.Core.Application/*.csproj src/Esi.Core.Application/packages.lock.json src/Esi.Core.Application/
COPY src/Esi.Core.Domain/*.csproj src/Esi.Core.Domain/packages.lock.json src/Esi.Core.Domain/
COPY src/Esi.Core.Infrastructure/*.csproj src/Esi.Core.Infrastructure/packages.lock.json src/Esi.Core.Infrastructure/
COPY tests/Esi.Core.UnitTests/*.csproj tests/Esi.Core.UnitTests/packages.lock.json tests/Esi.Core.UnitTests/
COPY tests/Esi.Core.IntegrationTests/*.csproj tests/Esi.Core.IntegrationTests/packages.lock.json tests/Esi.Core.IntegrationTests/
RUN dotnet restore --locked-mode && dotnet tool restore

FROM restore AS test
COPY src ./src
COPY tests ./tests
RUN dotnet format --verify-no-changes --no-restore --exclude src/Esi.Core.Infrastructure/Persistence/Migrations \
 && dotnet build -c Release --no-restore \
 && dotnet test --project tests/Esi.Core.UnitTests -c Release --no-build

FROM test AS integration-test
ENTRYPOINT ["dotnet", "test", "--project", "tests/Esi.Core.IntegrationTests", "-c", "Release", "--no-build"]

FROM test AS publish
ARG VERSION=0.0.0
RUN dotnet publish src/Esi.Core.Api -c Release --no-restore -o /app /p:Version=${VERSION} /p:UseAppHost=false

FROM test AS bundle
RUN dotnet ef migrations bundle --project src/Esi.Core.Infrastructure --startup-project src/Esi.Core.Infrastructure \
      --configuration Release --output /out/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:10.0.13-noble AS migrator
WORKDIR /app
COPY --from=bundle --chown=app:app /out/efbundle ./efbundle
USER $APP_UID
# Connection from ESI_CORE_AppDb__ConnectionString (read by the design-time factory) or --connection.
ENTRYPOINT ["./efbundle"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0.13-noble AS runtime
ARG VERSION=0.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.title="esi-core" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/dtnam0899/edge-side-includes"
WORKDIR /app
COPY --from=publish --chown=app:app /app ./
ENV ASPNETCORE_HTTP_PORTS=8080
USER $APP_UID
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["dotnet", "Esi.Core.Api.dll", "healthcheck"]
ENTRYPOINT ["dotnet", "Esi.Core.Api.dll"]
