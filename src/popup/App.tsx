import { Button } from "@/components/ui/button";
import "./App.css";

export default function App() {
  const sendMessage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            type: "TAKE_SCREEN_SHORT",
            payload: { message: "Open crop tool" },
          },
          (response) => {
            console.log("Response from content script:", response);
          }
        );
      }
    });
  };

  return (
    <div className="px-4 py-8 flex flex-col items-center justify-center gap-4">
      <Button onClick={sendMessage}>Take Screenshot</Button>
    </div>
  );
}
