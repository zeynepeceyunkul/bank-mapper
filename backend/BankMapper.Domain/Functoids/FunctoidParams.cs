namespace BankMapper.Domain.Functoids;

internal static class FunctoidParams
{
    public static int GetInt(Dictionary<string, object>? parameters, string key, int fallback)
    {
        if (parameters is null || !parameters.TryGetValue(key, out var value) || value is null)
        {
            return fallback;
        }

        return Convert.ToInt32(value);
    }

    public static string GetString(Dictionary<string, object>? parameters, string key, string fallback)
    {
        if (parameters is null || !parameters.TryGetValue(key, out var value) || value is null)
        {
            return fallback;
        }

        return value.ToString() ?? fallback;
    }
}
