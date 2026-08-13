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
    OldestFirst
}
