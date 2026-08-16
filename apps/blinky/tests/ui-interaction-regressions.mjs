import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const topBarPath = new URL('../src/ui/components/TopControlBar.tsx', import.meta.url);
const browserPath = new URL('../src/ui/components/AIHereBrowser.tsx', import.meta.url);
const stylesPath = new URL('../src/ui/index.css', import.meta.url);
const electronMainPath = new URL('../src/electron/main.ts', import.meta.url);
const preloadPath = new URL('../src/electron/preload.cts', import.meta.url);
const environmentPath = new URL('../src/electron/environment.ts', import.meta.url);
const imageMediaTypePath = new URL('../src/electron/imageMediaType.ts', import.meta.url);
const webResearchAgentPath = new URL('../src/electron/webResearchAgent.ts', import.meta.url);
const guideArrowPath = new URL('../src/ui/components/GuideArrow.tsx', import.meta.url);
const appPath = new URL('../src/ui/App.tsx', import.meta.url);
const annotationPlanPath = new URL('../src/ui/screenAnnotations.ts', import.meta.url);
const annotationOverlayPath = new URL('../src/ui/components/ScreenAnnotationOverlay.tsx', import.meta.url);
const credentialVaultPath = new URL('../src/electron/credentialVault.ts', import.meta.url);

async function verifyToolbarColorPicker() {
  const [topBar, styles] = await Promise.all([
    readFile(topBarPath, 'utf8'),
    readFile(stylesPath, 'utf8'),
  ]);

  assert.match(topBar, /className="toolbar-color-picker"/);
  assert.doesNotMatch(topBar, /absolute top-9 right-0/);
  assert.match(styles, /\.toolbar-color-picker\s*{[^}]*display:\s*flex;/s);
}

async function verifyBrowserAgentInput() {
  const browser = await readFile(browserPath, 'utf8');
  const sidePanel = browser.slice(browser.indexOf('className="aihere-side-panel"'));

  assert.match(sidePanel, /className="aihere-command-bar"/);
  assert.match(sidePanel, /placeholder="Research or complete a web task…"/);
  assert.match(sidePanel, /value={aiHerePrompt}/);
  assert.match(sidePanel, /onChange=\{\(event\) => setAiHerePrompt\(event\.target\.value\)\}/);
}

async function verifyClaudeProvider() {
  const [electronMain, preload, environment, imageMediaType] = await Promise.all([
    readFile(electronMainPath, 'utf8'),
    readFile(preloadPath, 'utf8'),
    readFile(environmentPath, 'utf8'),
    readFile(imageMediaTypePath, 'utf8'),
  ]);

  assert.match(electronMain, /process\.env\.ANTHROPIC_API_KEY/);
  assert.match(electronMain, /https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.match(electronMain, /'anthropic-version': '2023-06-01'/);
  assert.match(electronMain, /type: 'image'/);
  assert.match(preload, /claudeChat/);
  assert.match(preload, /claudeVision/);
  assert.doesNotMatch(preload, /gemini|gemma/i);
  assert.match(electronMain, /loadBlinkyEnvironment\(\)/);
  assert.match(environment, /fileURLToPath\(moduleUrl\)/);
  assert.match(environment, /path\.resolve\(compiledModuleDirectory, '\.\.', '\.env'\)/);
  assert.doesNotMatch(electronMain, /process\.cwd\(\).*\.env/);
  assert.match(electronMain, /media_type: detectImageMediaType\(base64Image\)/);
  assert.match(imageMediaType, /startsWith\('iVBOR'\).*'image\/png'/);
  assert.match(imageMediaType, /startsWith\('\/9j\/'\).*'image\/jpeg'/);
}

async function verifyWebResearchAgent() {
  const agent = await readFile(webResearchAgentPath, 'utf8');
  assert.match(agent, /export async function researchWeb\(goal: string\)/);
  assert.match(agent, /web_search_20260318/);
  assert.match(agent, /max_uses: 8/);
  assert.match(agent, /targetUrl: sources\[0\]\?\.url/);
}

async function verifyPersistentGuidePointer() {
  const [guideArrow, app, styles] = await Promise.all([
    readFile(guideArrowPath, 'utf8'),
    readFile(appPath, 'utf8'),
    readFile(stylesPath, 'utf8'),
  ]);

  assert.match(guideArrow, /className="guide-pointer-motion"/);
  assert.match(guideArrow, /className="guide-pointer-aura"/);
  assert.match(guideArrow, /<MousePointer2/);
  assert.match(guideArrow, />Blinky Guide<\/span>/);
  assert.doesNotMatch(guideArrow, />Clicky Guide<\/span>/);
  assert.match(guideArrow, /transition={{[\s\S]*duration: 1\.15/);
  assert.match(app, /window\.screen\.width/);
  assert.match(app, /window\.screen\.height/);
  assert.doesNotMatch(styles, /\.guide-pointer-motion\s*{[^}]*animation:/s);
}

async function verifyScreenConceptAnnotations() {
  const [plan, overlay, app, guideArrow] = await Promise.all([
    readFile(annotationPlanPath, 'utf8'),
    readFile(annotationOverlayPath, 'utf8'),
    readFile(appPath, 'utf8'),
    readFile(guideArrowPath, 'utf8'),
  ]);
  assert.match(plan, /parseScreenAnnotationPlan\(response: string, imageWidth: number, imageHeight: number\)/);
  assert.match(plan, /coordinateSpace/);
  assert.match(plan, /numericValue \/ axisSize \* 100/);
  assert.match(plan, /'arrow' \| 'line' \| 'circle' \| 'box' \| 'label'/);
  assert.match(overlay, /<motion\.line/);
  assert.match(overlay, /<motion\.ellipse/);
  assert.match(overlay, /<motion\.rect/);
  assert.match(app, /explain this YouTube frame on screen/);
  assert.match(app, /setScreenAnnotations\(annotationPlan\.annotations\)/);
  assert.match(app, /getScreenshotDimensions\(screenSnapshotData\)/);
  assert.match(app, /coordinateSpace.*pixels/s);
  assert.match(app, /geometry verifier/i);
  assert.match(app, /const verifiedPlan = parseScreenAnnotationPlan/);
  assert.match(overlay, /addEventListener\('resize'/);
  assert.match(guideArrow, /screenAnnotations\.length === 0/);
  assert.match(plan, /MAX_SHAPE_WIDTH_PERCENT/);
  assert.match(plan, /MAX_ELLIPSE_ASPECT_RATIO/);
}

async function verifyVoiceTranscription() {
  const [app, electronMain, preload] = await Promise.all([
    readFile(appPath, 'utf8'),
    readFile(electronMainPath, 'utf8'),
    readFile(preloadPath, 'utf8'),
  ]);

  assert.match(electronMain, /transcribe-windows-speech/);
  assert.match(electronMain, /System\.Speech\.Recognition/);
  assert.match(electronMain, /New-Object System\.Speech\.Recognition\.SpeechRecognitionEngine\s*\n/);
  assert.doesNotMatch(electronMain, /SpeechRecognitionEngine\(\$recognizerInfo\.Culture\)/);
  assert.match(preload, /transcribeSpeech/);
  assert.match(preload, /startWindowsVoiceTyping/);
  assert.match(app, /window\.electron\.transcribeSpeech\(\)/);
  assert.match(app, /handleSpeechInput\(result\.text\)/);
  assert.match(app, /startWindowsVoiceTyping\(\)/);
  assert.match(app, /waiting for you to finish/);
  assert.match(app, /Listening… Speak now, then pause\./);
  assert.doesNotMatch(app, /audioChunksRef/);
}

async function verifyBrowserWorkspace() {
  const [browser, vault, main, preload, agent] = await Promise.all([
    readFile(browserPath, 'utf8'),
    readFile(credentialVaultPath, 'utf8'),
    readFile(electronMainPath, 'utf8'),
    readFile(preloadPath, 'utf8'),
    readFile(webResearchAgentPath, 'utf8'),
  ]);
  assert.match(browser, /browser-session-grid/);
  assert.match(browser, /partition={`persist:blinky-browser-\${session\.id}`}/);
  assert.match(browser, /Sources grid/);
  assert.match(browser, /Secure credential vault/);
  assert.match(vault, /safeStorage\.encryptString/);
  assert.match(vault, /webContents\.fromId/);
  assert.match(main, /credentials-apply/);
  assert.match(preload, /applySiteCredential/);
  assert.match(agent, /planResearchTracks/);
  assert.match(agent, /Promise\.allSettled/);
  assert.match(agent, /exactly 3 or 4 independent research tracks/);
  assert.match(browser, /step\.kind === 'task'/);
  assert.match(browser, /setSessions\(nextSessions\)/);
}

await verifyToolbarColorPicker();
await verifyBrowserAgentInput();
await verifyClaudeProvider();
await verifyWebResearchAgent();
await verifyPersistentGuidePointer();
await verifyScreenConceptAnnotations();
await verifyVoiceTranscription();
await verifyBrowserWorkspace();
console.log('UI interaction regression checks passed.');
