# Cloud Run icin - sadece BankMapper.Api'yi (ve onun bagimli oldugu
# Application/Domain/Infrastructure projelerini) derleyip yayinlar,
# BankMapper.Tests dahil edilmez. `docker build -t bank-mapper-api .`
# bu dosyanin bulundugu backend/ klasorunden calistirilmali.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Once sadece .csproj dosyalarini kopyalayip restore etmek - kaynak kod
# degisince (csproj'lar degismedigi surece) Docker'in restore katmanini
# tekrar calistirmasina gerek kalmiyor, sonraki build'ler hizlaniyor.
COPY BankMapper.Api/BankMapper.Api.csproj BankMapper.Api/
COPY BankMapper.Application/BankMapper.Application.csproj BankMapper.Application/
COPY BankMapper.Domain/BankMapper.Domain.csproj BankMapper.Domain/
COPY BankMapper.Infrastructure/BankMapper.Infrastructure.csproj BankMapper.Infrastructure/
RUN dotnet restore BankMapper.Api/BankMapper.Api.csproj

COPY BankMapper.Api/ BankMapper.Api/
COPY BankMapper.Application/ BankMapper.Application/
COPY BankMapper.Domain/ BankMapper.Domain/
COPY BankMapper.Infrastructure/ BankMapper.Infrastructure/

RUN dotnet publish BankMapper.Api/BankMapper.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Cloud Run varsayilan olarak container'in 8080 portunu dinlemesini bekliyor.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "BankMapper.Api.dll"]
