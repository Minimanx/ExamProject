import { chromium } from "@playwright/test";

const BASE = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];
const trials = [
    ["baseline", BASE],
    ["no oop audio", [...BASE, "--disable-features=AudioServiceOutOfProcess"]],
    ["audio sandbox off", [...BASE, "--disable-features=AudioServiceSandbox"]],
    ["both", [...BASE, "--disable-features=AudioServiceOutOfProcess,AudioServiceSandbox"]],
];

for (const [label, args] of trials) {
    const browser = await chromium.launch({ args });
    const context = await browser.newContext({ permissions: ["microphone"] });
    const page = await context.newPage();
    await page.goto("http://localhost:8123/");
    const result = await page.evaluate(async () => {
        try {
            const s = await Promise.race([
                navigator.mediaDevices.getUserMedia({ audio: true }),
                new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 6000)),
            ]);
            return "ok tracks=" + s.getAudioTracks().length;
        } catch (e) {
            return "FAIL " + e.message;
        }
    });
    console.log(`${label}: ${result}`);
    await browser.close();
}
