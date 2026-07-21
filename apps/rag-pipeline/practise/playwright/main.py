import asyncio
from playwright.async_api import async_playwright, Playwright

# refer the playwright docs for it 
# https://playwright.dev/python/docs/api/class-playwright
# Browser is used to open up a browser and BroserContext is used to open muple indepent browser sessions
# we inject some js into it to make it seem like real browser and get fast cloudlfare
# assembled and some written from various sources: 
# https://github.com/berstend/puppeteer-extra/blob/master/packages/puppeteer-extra-plugin-stealth/readme.md
# https://app.unpkg.com/puppeteer-extra-plugin-stealth%402.4.0/files/evasions/navigator.webdriver/readme.md
# https://github.com/berstend/puppeteer-extra/blob/master/packages/puppeteer-extra-plugin-stealth/readme.md
# https://github.com/berstend/puppeteer-extra/blob/master/packages/puppeteer-extra-plugin-stealth/readme.md
# https://docs.iproyal.com/proxies/residential/api/access
# includes all functiomms reated to broser activiti (via injecting raw js here)
# generate and send email summary (involbes html and email client)
# custom prompt written for the question which is written on the platform on which bidding id gone
# https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/python
# anthropic package is used for calling the claude LLM here
# one for writing the message and one for complainace check by claude models
# for testing of the mtheod we use 

async def run(playwright: Playwright):
    chromium = playwright.chromium
    browser = await chromium.launch()
    page = await browser.new_page()
    await page.goto("https://example.com")
    await brower.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)

asyncio.run(main())