namespace BankMapper.Domain.Execution;

public static class SourceFieldKey
{
    public static string Build(string sourceSchemaId, string fieldName) => $"{sourceSchemaId}::{fieldName}";
}
