using System.Text;
using System.Text.RegularExpressions;

namespace Pim.Api.Middleware;

// Logs every request's verb/URL(+querystring)/body and every response's status code/size/body (truncated), at
// Information level. Redacts the /login password field and the /transactions/file upload's raw content.
public sealed partial class RequestResponseLoggingMiddleware
{
    public const int MaxLoggedBodyChars = 2000;

    private readonly RequestDelegate _next;

    public RequestResponseLoggingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ILogger<RequestResponseLoggingMiddleware> logger)
    {
        var requestBody = await ReadRequestBodyAsync(context.Request);
        logger.LogInformation(
            "HTTP request: {Method} {Path}{QueryString} body={Body}",
            context.Request.Method,
            context.Request.Path,
            context.Request.QueryString,
            requestBody);

        var originalResponseBody = context.Response.Body;
        await using var capturedResponseBody = new MemoryStream();
        context.Response.Body = capturedResponseBody;

        try
        {
            await _next(context);
        }
        finally
        {
            context.Response.Body = originalResponseBody;
        }

        capturedResponseBody.Position = 0;
        var responseBody = await ReadTruncatedAsync(capturedResponseBody);
        logger.LogInformation(
            "HTTP response: {StatusCode} bytes={Bytes} body={Body}",
            context.Response.StatusCode,
            capturedResponseBody.Length,
            responseBody);

        capturedResponseBody.Position = 0;
        await capturedResponseBody.CopyToAsync(originalResponseBody);
    }

    // Only the first MaxLoggedBodyChars are logged, so large responses (e.g. full transaction
    // history) don't flood CloudWatch or cost a full string copy.
    private static async Task<string> ReadTruncatedAsync(Stream body)
    {
        using var reader = new StreamReader(body, Encoding.UTF8, leaveOpen: true);
        // Read one extra char to detect truncation without EndOfStream (CA2024).
        var buffer = new char[MaxLoggedBodyChars + 1];
        var read = await reader.ReadBlockAsync(buffer, 0, buffer.Length);
        return read > MaxLoggedBodyChars
            ? new string(buffer, 0, MaxLoggedBodyChars) + "...[truncated]"
            : new string(buffer, 0, read);
    }

    // Multipart form bodies (the /transactions/file upload) are binary-boundary-delimited, not
    // meaningful text - read the parsed form instead (ReadFormAsync caches it on
    // HttpContext.Request.Form, so the controller's own [FromForm] binding afterward reuses the
    // same parse rather than re-reading the stream) and log every field except the file's content.
    // Everything else is a plain text/JSON body - buffer it so the controller can still read it
    // after we do, and redact any "password" JSON field generically (not hardcoded to /login).
    private static async Task<string> ReadRequestBodyAsync(HttpRequest request)
    {
        if (request.HasFormContentType)
        {
            var form = await request.ReadFormAsync();
            var fields = form.Select(f => $"{f.Key}={f.Value}")
                .Concat(form.Files.Select(f => $"{f.Name}=[file: {f.FileName}, {f.Length} bytes]"));
            return string.Join('&', fields);
        }

        if (request.ContentLength is null or 0)
        {
            return string.Empty;
        }

        request.EnableBuffering();
        request.Body.Position = 0;
        var body = await new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true).ReadToEndAsync();
        request.Body.Position = 0;

        return PasswordFieldRegex().Replace(body, @"""password"":""***""");
    }

    [GeneratedRegex("\"password\"\\s*:\\s*\"[^\"]*\"", RegexOptions.IgnoreCase)]
    private static partial Regex PasswordFieldRegex();
}
