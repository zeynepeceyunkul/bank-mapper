using BankMapper.Application.FileTypes;
using BankMapper.Application.Products;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController(IProductService productService, IFileTypeService fileTypeService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ProductDto>>> GetProducts()
    {
        var products = await productService.GetAllAsync();
        return Ok(products);
    }

    [HttpGet("{id}/file-types")]
    public async Task<ActionResult<List<FileTypeDto>>> GetFileTypes(string id)
    {
        var fileTypes = await fileTypeService.GetFileTypesByProductIdAsync(id);
        return Ok(fileTypes);
    }
}
