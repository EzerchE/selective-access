using System;
using System.Collections.Generic;
using System.Diagnostics;
using target.example;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

internal static class SelectiveAccessDnsHost
{
    private const int MaximumMessageBytes = 1024 * 1024;
    private const string SyncTaskName = "SelectiveAccessDnsSync";
    private static readonly Regex DomainPattern = new Regex(
        @"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

    private sealed class Request
    {
        public string[] domains { get; set; }
    }

    private sealed class Response
    {
        public bool ok { get; set; }
        public string error { get; set; }
        public int domainCount { get; set; }
    }

    public static int Main()
    {
        using (var input = Console.OpenStandardInput())
        using (var output = Console.OpenStandardOutput())
        {
            while (true)
            {
                var payload = ReadMessage(input);
                if (payload == null) return 0;
                Response response;
                try
                {
                    var request = Json.Deserialize<Request>(payload) ?? new Request();
                    response = Synchronize(request.domains ?? new string[0]);
                }
                catch (Exception error)
                {
                    response = new Response { ok = false, error = error.Message, domainCount = 0 };
                }
                WriteMessage(output, Json.Serialize(response));
            }
        }
    }

    private static Response Synchronize(IEnumerable<string> values)
    {
        var domains = values
            .Select(value => (value ?? string.Empty).Trim().Trim('.').ToLowerInvariant())
            .Where(value => DomainPattern.IsMatch(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
            .Take(500)
            .ToArray();

        using (var mutex = new Mutex(false, "Local\\SelectiveAccessDnsHostSync"))
        {
            if (!mutex.WaitOne(TimeSpan.FromSeconds(15)))
            {
                return new Response { ok = false, error = "Seçici DNS eşitlemesi meşgul.", domainCount = domains.Length };
            }
            try
            {
                var dataDirectory = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SelectiveAccess");
                Directory.CreateDirectory(dataDirectory);
                var desiredFile = Path.Combine(dataDirectory, "dns-domains.txt");
                var resultFile = Path.Combine(dataDirectory, "dns-result.txt");
                var requestId = Guid.NewGuid().ToString("N");
                var temporaryFile = desiredFile + ".tmp";
                File.WriteAllLines(temporaryFile, new[] { requestId }.Concat(domains), new UTF8Encoding(false));
                if (File.Exists(desiredFile)) File.Delete(desiredFile);
                File.Move(temporaryFile, desiredFile);
                if (File.Exists(resultFile)) File.Delete(resultFile);

                var start = new ProcessStartInfo
                {
                    FileName = "schtasks.exe",
                    Arguments = "/Run /TN \"" + SyncTaskName + "\"",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using (var process = Process.Start(start))
                {
                    process.WaitForExit(5000);
                    if (!process.HasExited || process.ExitCode != 0)
                    {
                        var detail = process.HasExited ? process.StandardError.ReadToEnd().Trim() : string.Empty;
                        return new Response
                        {
                            ok = false,
                            error = string.IsNullOrWhiteSpace(detail)
                                ? "Seçici DNS görevi başlatılamadı; yardımcı kurulumu yeniden çalıştırın."
                                : detail,
                            domainCount = domains.Length
                        };
                    }
                }

                var deadline = DateTime.UtcNow.AddSeconds(12);
                while (DateTime.UtcNow < deadline)
                {
                    if (File.Exists(resultFile))
                    {
                        var lines = File.ReadAllLines(resultFile, Encoding.UTF8);
                        if (lines.Length >= 2 && lines[0] == requestId)
                        {
                            var ok = lines[1] == "ok=1";
                            return new Response
                            {
                                ok = ok,
                                error = ok ? null : (lines.Length >= 3 ? lines[2] : "Seçici DNS uygulanamadı."),
                                domainCount = domains.Length
                            };
                        }
                    }
                    Thread.Sleep(150);
                }
                return new Response { ok = false, error = "Seçici DNS eşitlemesi zaman aşımına uğradı.", domainCount = domains.Length };
            }
            finally
            {
                mutex.ReleaseMutex();
            }
        }
    }

    private static string ReadMessage(Stream input)
    {
        var header = new byte[4];
        var read = input.Read(header, 0, header.Length);
        if (read == 0) return null;
        if (read != header.Length) throw new InvalidDataException("Eksik native mesaj başlığı.");
        var length = BitConverter.ToInt32(header, 0);
        if (length < 0 || length > MaximumMessageBytes) throw new InvalidDataException("Native mesaj boyutu geçersiz.");
        var buffer = new byte[length];
        var offset = 0;
        while (offset < length)
        {
            read = input.Read(buffer, offset, length - offset);
            if (read <= 0) throw new EndOfStreamException("Native mesaj tamamlanamadı.");
            offset += read;
        }
        return Encoding.UTF8.GetString(buffer);
    }

    private static void WriteMessage(Stream output, string payload)
    {
        var bytes = Encoding.UTF8.GetBytes(payload);
        var header = BitConverter.GetBytes(bytes.Length);
        output.Write(header, 0, header.Length);
        output.Write(bytes, 0, bytes.Length);
        output.Flush();
    }
}
