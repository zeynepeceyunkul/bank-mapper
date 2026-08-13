using BankMapper.Domain.Enums;
using BankMapper.Domain.Execution;
using Xunit;

namespace BankMapper.Tests.Execution;

public class FieldFormatValidatorTests
{
    [Theory]
    [InlineData("TR330006100519786457841326")] // gercek mod-97 checksum'i gecerli test IBAN'i
    public void Valid_iban_passes(string iban) =>
        Assert.True(FieldFormatValidator.IsValid(FieldValidationFormat.Iban, iban));

    [Theory]
    [InlineData("TR330006100519786457841327")] // son hane kasitli bozuldu
    [InlineData("TR33")]
    [InlineData("not-an-iban")]
    public void Invalid_iban_fails(string iban) =>
        Assert.False(FieldFormatValidator.IsValid(FieldValidationFormat.Iban, iban));

    [Theory]
    [InlineData("10000000146")] // yaygin kullanilan, checksum'i gecerli test TC kimlik no'su
    public void Valid_tc_kimlik_no_passes(string tc) =>
        Assert.True(FieldFormatValidator.IsValid(FieldValidationFormat.TcKimlikNo, tc));

    [Theory]
    [InlineData("10000000147")] // son hane kasitli bozuldu
    [InlineData("00000000146")] // ilk hane 0 olamaz
    [InlineData("123")] // yanlis uzunluk
    [InlineData("1000000014a")] // rakam degil
    public void Invalid_tc_kimlik_no_fails(string tc) =>
        Assert.False(FieldFormatValidator.IsValid(FieldValidationFormat.TcKimlikNo, tc));

    [Theory]
    [InlineData("100")]
    [InlineData("0")]
    [InlineData("1234.56")]
    public void Valid_positive_decimal_passes(string value) =>
        Assert.True(FieldFormatValidator.IsValid(FieldValidationFormat.PositiveDecimal, value));

    [Theory]
    [InlineData("-1")]
    [InlineData("abc")]
    [InlineData("")]
    public void Invalid_positive_decimal_fails(string value) =>
        Assert.False(FieldFormatValidator.IsValid(FieldValidationFormat.PositiveDecimal, value));
}
