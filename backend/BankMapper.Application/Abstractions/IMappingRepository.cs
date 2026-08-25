using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.Abstractions;

public interface IMappingRepository
{
    Task<List<Mapping>> GetAllAsync(MappingStatus? status = null, string? kurumId = null);

    Task<(List<Mapping> Items, long TotalCount)> GetPagedAsync(
        int pageIndex, int pageSize, SortOption sort, string? search = null, MappingStatus? status = null,
        string? kurumId = null, string? createdBy = null);

    Task<Mapping?> GetByIdAsync(string id);

    Task<Mapping> CreateAsync(Mapping mapping);

    Task<Mapping?> UpdateAsync(Mapping mapping);

    // ApproveAsync/RejectAsync icin - normal UpdateAsync sadece Id'ye gore
    // yaziyor, iki kisi ayni mapping'i NEREDEYSE AYNI ANDA onaylayip/reddedip
    // ikisi de C# tarafindaki "Status hala PendingApproval mi" kontrolunu
    // (okuma anindaki eski veriyle) gecebiliyordu - kim son yazarsa o
    // kazanip digerinin karari sessizce siliniyordu. Bu metod, filtreye
    // Status'u da ekleyip Mongo'nun kendisine "sadece hala beklenen durumdaysa
    // yaz" dedirtiyor - MatchedCount 0 donerse, aradaki sirada baskasi zaten
    // karara baglamis demektir.
    Task<Mapping?> UpdateIfStatusAsync(Mapping mapping, MappingStatus expectedCurrentStatus);

    Task<bool> DeleteAsync(string id);
}
