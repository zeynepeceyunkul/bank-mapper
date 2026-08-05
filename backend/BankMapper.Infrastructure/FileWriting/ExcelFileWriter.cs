using BankMapper.Application.FileWriting;
using ClosedXML.Excel;

namespace BankMapper.Infrastructure.FileWriting;

public class ExcelFileWriter : IFileWriter
{
    public string ContentType => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public string FileExtension => "xlsx";

    public byte[] Write(List<Dictionary<string, object?>> rows)
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Sonuc");

        if (rows.Count > 0)
        {
            var columns = rows[0].Keys.ToList();
            for (var c = 0; c < columns.Count; c++)
            {
                worksheet.Cell(1, c + 1).Value = columns[c];
            }

            for (var r = 0; r < rows.Count; r++)
            {
                for (var c = 0; c < columns.Count; c++)
                {
                    worksheet.Cell(r + 2, c + 1).Value = rows[r].GetValueOrDefault(columns[c])?.ToString() ?? string.Empty;
                }
            }
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
