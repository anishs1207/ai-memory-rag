using System;
using System.Drawing;
using System.Windows.Forms;

namespace BlinkyDesktopApp
{
    public class BlinkyMainForm : Form
    {
        private WebBrowser webBrowser;

        public BlinkyMainForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Blinky AI Desktop Assistant v1.2.0";
            this.Size = new Size(1280, 850);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(15, 23, 42); // Dark slate background

            // Configure Browser Emulation Registry Key for modern rendering
            try
            {
                using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(
                    @"Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION"))
                {
                    if (key != null)
                    {
                        string appName = System.IO.Path.GetFileName(Application.ExecutablePath);
                        key.SetValue(appName, 11001, Microsoft.Win32.RegistryValueKind.DWord);
                    }
                }
            }
            catch { }

            // Create Full-Frame WebBrowser Control
            webBrowser = new WebBrowser();
            webBrowser.Dock = DockStyle.Fill;
            webBrowser.ScriptErrorsSuppressed = true;
            webBrowser.IsWebBrowserContextMenuEnabled = true;

            this.Controls.Add(webBrowser);

            // Navigate to React Blinky Web Assistant URL on Window Load
            this.Load += (s, e) =>
            {
                webBrowser.Navigate("http://localhost:3000/blinky");
            };
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new BlinkyMainForm());
        }
    }
}
