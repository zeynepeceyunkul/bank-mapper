using System.Globalization;
using System.Text;
using BankMapper.Domain.Enums;

namespace BankMapper.Domain.Execution;

// Bilinen, matematiksel olarak dogrulanabilir birkac format icin checksum/format
// kontrolu - 4a'da bir kez functoid olarak inşa edilip geri alinmisti (yanlis
// mekanizma: canvas'a manuel suruklenen, unutulabilir bir node'du). Bu sefer
// TargetField.Length kontroluyle ayni yerde (MappingExecutor), otomatik ve sert
// hata veren bir kontrol olarak kuruluyor.
public static class FieldFormatValidator
{
    public static bool IsValid(FieldValidationFormat format, string value) => format switch
    {
        FieldValidationFormat.None => true,
        FieldValidationFormat.Iban => IsValidIban(value),
        FieldValidationFormat.TcKimlikNo => IsValidTcKimlikNo(value),
        FieldValidationFormat.PositiveDecimal => IsValidPositiveDecimal(value),
        _ => true,
    };

    // ISO 7064 MOD97-10: ilk 4 karakter sona tasinir, harfler iki haneli sayiya
    // cevrilir (A=10..Z=35), elde edilen sayi 97'ye bolunur - kalan 1 olmali.
    private static bool IsValidIban(string value)
    {
        var cleaned = value.Replace(" ", "").ToUpperInvariant();
        if (cleaned.Length < 5 || !cleaned.Skip(4).All(char.IsLetterOrDigit))
        {
            return false;
        }

        var rearranged = cleaned[4..] + cleaned[..4];
        var numeric = new StringBuilder();
        foreach (var c in rearranged)
        {
            if (char.IsDigit(c))
            {
                numeric.Append(c);
            }
            else if (c is >= 'A' and <= 'Z')
            {
                numeric.Append(c - 'A' + 10);
            }
            else
            {
                return false;
            }
        }

        var remainder = 0;
        foreach (var c in numeric.ToString())
        {
            remainder = (remainder * 10 + (c - '0')) % 97;
        }

        return remainder == 1;
    }

    // Resmi TC Kimlik No algoritmasi: 10. hane = ((1,3,5,7,9. hanelerin
    // toplami)*7 - (2,4,6,8. hanelerin toplami)) mod 10; 11. hane = ilk 10
    // hanenin toplami mod 10.
    private static bool IsValidTcKimlikNo(string value)
    {
        if (value.Length != 11 || !value.All(char.IsDigit) || value[0] == '0')
        {
            return false;
        }

        var d = value.Select(c => c - '0').ToArray();
        var oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
        var evenSum = d[1] + d[3] + d[5] + d[7];
        var check10 = ((oddSum * 7) - evenSum) % 10;
        if (check10 < 0)
        {
            check10 += 10;
        }

        if (check10 != d[9])
        {
            return false;
        }

        var check11 = d.Take(10).Sum() % 10;
        return check11 == d[10];
    }

    private static bool IsValidPositiveDecimal(string value) =>
        decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var result) && result >= 0;
}
