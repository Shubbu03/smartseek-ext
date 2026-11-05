import { fakeBrowser } from "wxt/testing/fake-browser";

// WXT's fake sendMessage omits MessageSender. Dispatch through the real listener
// with browser-supplied identity, rather than weakening production authorization.
export function deliverMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let responded = false;
    void fakeBrowser.runtime.onMessage.trigger(message, sender, (response: unknown) => {
      responded = true;
      resolve(structuredClone(response));
    }).then((results) => {
      if (!responded && !results.some((result: unknown) => result === true)) {
        reject(new Error("No SmartSeek listener accepted this request."));
      }
    }, reject);
  });
}
