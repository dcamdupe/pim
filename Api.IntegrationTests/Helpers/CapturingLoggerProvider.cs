using Microsoft.Extensions.Logging;

namespace Pim.Api.IntegrationTests.Helpers;

// Layers onto a WebApplicationFactory via ConfigureLogging(logging => logging.AddProvider(...)) to
// capture real formatted log lines from the real pipeline (no mocking of ILogger call sites needed).
public sealed class CapturingLoggerProvider(List<string> sink) : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new CapturingLogger(sink);

    public void Dispose()
    {
    }

    private sealed class CapturingLogger(List<string> sink) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            lock (sink)
            {
                sink.Add(formatter(state, exception));
            }
        }
    }
}
