# Bank Mapper

Banka/finans dosya formatları (CSV, Excel, sabit uzunluklu metin) arasında görsel, graph tabanlı bir eşleme (mapping) aracı. Bir kaynak dosyayı belirli bir hedef dosya formatına, functoid'ler (Trim, LPad, RPad, Concat, Upper, Lower) ve sabit değerlerle dönüştürerek eşlemeyi ve önizlemeyi/dönüştürmeyi sağlar.

## Teknoloji yığını

- **Frontend**: Angular 22 (standalone components, signals), mapping canvas için AntV X6
- **Backend**: .NET 10 Web API, katmanlı mimari (Domain / Application / Infrastructure / Api)
- **Veritabanı**: MongoDB
- **Loglama**: Serilog (konsol + günlük rotasyonlu JSON dosya sink'i)

## Mimari

```mermaid
flowchart LR
    UI["Angular UI\n(mapping canvas, source şema, önizleme)"] -->|REST/JSON| API["BankMapper.Api\n(.NET 10, controllers)"]
    API --> APP["BankMapper.Application\n(servisler, validasyon, MappingExecutor)"]
    APP --> DOMAIN["BankMapper.Domain\n(entity'ler, functoid'ler, graph topolojik sıralama)"]
    APP --> INFRA["BankMapper.Infrastructure\n(Mongo repository'leri, dosya parser'ları)"]
    INFRA --> MONGO[("MongoDB")]
```

### Mapping çalıştırma akışı

```mermaid
flowchart LR
    SRC["Kaynak dosya(lar)\n(CSV / Excel / Sabit Uzunluk)"] --> PARSE["FileParser"]
    PARSE --> JOIN["Coklu kaynak ise\njoin-key ile birlestir"]
    JOIN --> EXEC["MappingExecutor\n(graph topolojik sıralama + functoid'ler)"]
    EXEC --> OUT["Hedef satırlar\n(önizleme veya CSV indirme)"]
```

Bir mapping; kaynak şema referansları, functoid node'ları, sabit değer node'ları ve bunları birbirine (ve hedef alanlara) bağlayan kenarlardan (edge) oluşan bir graph olarak saklanır. `MappingExecutor` bu graph'ı topolojik sıraya göre çalıştırıp her satır için hedef alanları üretir.

## Çalıştırma

Backend, MongoDB'nin `localhost:27017`'de çalışıyor olmasını bekler (bağlantı ayarı `backend/BankMapper.Api/appsettings.json` içinde `MongoDbSettings`).

```bash
cd backend/BankMapper.Api
dotnet run
```

```bash
cd frontend
npm install
npm start
```

Frontend varsayılan olarak `http://localhost:4200`, backend `http://localhost:5299` üzerinde çalışır (bkz. `frontend/src/environments/environment.ts`).

## Test

```bash
cd backend
dotnet test
```

```bash
cd frontend
npx ng test --watch=false
```

## Sağlık kontrolü

Backend ayaktayken `GET /health` MongoDB bağlantısının durumunu döner.
