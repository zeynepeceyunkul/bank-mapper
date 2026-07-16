using System.Text;
using BankMapper.Application.Preview;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/preview")]
public class PreviewController(IPreviewService previewService) : ControllerBase
{
    [HttpPost("execute")]
    public async Task<ActionResult<List<Dictionary<string, object?>>>> Execute([FromForm] ExecutePreviewFormRequest form)
    {
        if (form.File is null)
        {
            return BadRequest("Önizleme için bir dosya yüklenmesi gerekir.");
        }

        try
        {
            var rows = await previewService.ExecuteAsync(form.MappingId, form.File.OpenReadStream());
            return Ok(rows);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("convert")]
    public async Task<IActionResult> Convert([FromForm] ExecutePreviewFormRequest form)
    {
        if (form.File is null)
        {
            return BadRequest("Dönüştürme için bir dosya yüklenmesi gerekir.");
        }

        try
        {
            var csv = await previewService.ConvertToCsvAsync(form.MappingId, form.File.OpenReadStream());
            var bytes = Encoding.UTF8.GetBytes(csv);
            return File(bytes, "text/csv", "donusturulen-dosya.csv");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
