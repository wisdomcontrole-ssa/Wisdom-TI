using System.Runtime.InteropServices;

namespace InventarioTI.Agent;

internal static class NativeUi
{
    private const uint MbOk = 0x00000000;
    private const uint MbIconInformation = 0x00000040;
    private const uint MbSetForeground = 0x00010000;

    public static void Show(
        string title,
        string message)
    {
        _ = MessageBoxW(
            IntPtr.Zero,
            message,
            title,
            MbOk |
            MbIconInformation |
            MbSetForeground);
    }

    [DllImport(
        "user32.dll",
        CharSet = CharSet.Unicode,
        SetLastError = true)]
    private static extern int MessageBoxW(
        IntPtr hWnd,
        string text,
        string caption,
        uint type);
}
