namespace BankMapper.Application.Common;

// "En yeni/en eski" her varlik icin farkli bir alana denk gelir (Mapping ->
// UpdatedAt, SourceSchema -> CreatedAt) - cagiran taraf hangi alanin
// kullanildigini bilmek zorunda kalmasin diye RecentFirst/OldestFirst
// soyutlamasi kullaniliyor, alan adi repository katmaninda kaliyor.
public enum SortOption
{
    NameAscending,
    NameDescending,
    RecentFirst,
    OldestFirst,

    // Onaylar ekranindaki uc sekmenin (Bekleyenler/Onaylanan/Reddedilen) her
    // birinin kendi gosterdigi tarih sutununa gore siralamasi icin -
    // RecentFirst/OldestFirst'un aksine BURADA "hangi alan" status filtresine
    // gore degisiyor (Bekleyenler->CreatedAt, Onaylanan->ApprovedAt,
    // Reddedilen->RejectedAt), bu yuzden ayri bir isim: mapping-list gibi
    // baska bir ekranin hep UpdatedAt'e gore sirali RecentFirst/OldestFirst
    // davranisini bozmadan sadece Onaylar'in kendi mantigini tasiyor.
    StatusDateRecentFirst,
    StatusDateOldestFirst
}
