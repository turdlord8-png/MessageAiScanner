/**
 * MessageScanAI (Revenge-Xposed Mobile)
 * Author: anonymous
 * Version: 1.0.0-mobile
 * Description: Scans messages using Gemini AI to detect phishing/scams.
 */

module.exports = class MessageScanAI {
    constructor() {
        this.name = "MessageScanAI";
        this.author = "anonymous";
        this.version = "1.0.0-mobile";
        this.description = "Scan messages for phishing using Gemini AI.";
        
        // Internal references
        this.React = null;
        this.Modules = null;
        this.Patcher = null;
        this.Settings = null;
    }

    start() {
        // Load APIs from global "revenge" object
        this.React = revenge.React;
        this.Modules = revenge.modules;
        this.Patcher = revenge.patcher;
        this.Settings = revenge.settings;

        // Ensure settings exist
        if (!this.Settings.get("MessageScanAI_apiKey")) {
            this.Settings.set("MessageScanAI_apiKey", "");
        }

        // Apply patches
        this.patchMessages();

        console.log("[MessageScanAI] Started.");
    }

    stop() {
        this.Patcher.unpatchAll("MessageScanAI");
        console.log("[MessageScanAI] Stopped.");
    }

    patchMessages() {
        const Message = this.Modules.find(m => m?.default?.displayName === "Message");

        if (!Message) {
            console.log("[MessageScanAI] Could not locate Message component.");
            return;
        }

        this.Patcher.after("MessageScanAI", Message, "default", (ctx, args, res) => {
            const props = args[0];
            const msg = props?.message;
            if (!msg) return res;

            // Add Scan button
            const scanBtn = this.React.createElement(
                "button",
                {
                    style: {
                        marginLeft: 6,
                        padding: "3px 6px",
                        backgroundColor: "#5865F2",
                        color: "white",
                        border: "none",
                        borderRadius: 5,
                        fontSize: 12
                    },
                    onClick: () => this.scanMessage(msg)
                },
                "Scan AI"
            );

            // Wrap original message + button
            return this.React.createElement(
                "div",
                { style: { flexDirection: "row", display: "flex", alignItems: "center" } },
                res,
                scanBtn
            );
        });
    }
async scanMessage(message) {
        const apiKey = this.Settings.get("MessageScanAI_apiKey");
        if (!apiKey || apiKey === "") {
            revenge.ui.alert("MessageScanAI", "Please set your Gemini API key in plugin settings.");
            return;
        }

        try {
            const result = await this.sendToAI(message.content);
            revenge.ui.alert("Scan Result", result.rating + "\n\nReason: " + result.reason);
        } catch (err) {
            console.error("[MessageScanAI] Scan failed:", err);
            revenge.ui.alert("MessageScanAI Error", String(err));
        }
    }

    async sendToAI(content) {
        const apiKey = this.Settings.get("MessageScanAI_apiKey");

        const body = {
            contents: [{
                parts: [{ text: `The following message is from Discord chat: "${content}". Rate it as safe, caution, or scam and give a one-sentence reason.` }]
            }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) throw await response.text();

        const json = await response.json();
        const resultText = json.candidates?.[0]?.content?.parts?.[0]?.text || "unsure|No reason provided.";
        const parts = resultText.split("|");

        return {
            rating: parts[0]?.trim() || "unsure",
            reason: parts[1]?.trim() || "No reason provided."
        };
    }
highlightMessage(targetElement, rating) {
        if (!targetElement) return;

        let color, msg;
        const lightMode = document.querySelector("html")?.classList.contains("theme-light") || false;

        switch (rating.rating) {
            case "safe":
                color = lightMode ? "#008000" : "#40ff40";
                msg = "THIS MESSAGE IS VERY LIKELY SAFE";
                break;
            case "caution":
                color = lightMode ? "#808000" : "#ffff40";
                msg = "PROCEED WITH CAUTION";
                break;
            case "scam":
                color = lightMode ? "#800000" : "#ff4040";
                msg = "THIS MESSAGE IS VERY LIKELY A SCAM";
                break;
            default:
                color = lightMode ? "#000000" : "#ffffff";
                msg = "UNABLE TO DETERMINE SCAM LIKELIHOOD";
                break;
        }

        // Apply highlighting
        targetElement.style.boxShadow = `2px 0 0 0 ${color} inset`;
        targetElement.style.backgroundColor = `${color}33`; // semi-transparent highlight

        // Append reason below message
        const reasonDiv = document.createElement("div");
        reasonDiv.style.color = color;
        reasonDiv.style.fontSize = "75%";
        reasonDiv.style.lineHeight = "normal";
        reasonDiv.innerText = msg + (rating.reason ? "\nReason: " + rating.reason : "");
        targetElement.appendChild(reasonDiv);
    }

    showSetupPrompt() {
        revenge.ui.confirm(
            "MessageScanAI Setup",
            "You need a Google Gemini API key for this plugin to work.\n\nGet an API key, then paste it into plugin settings.",
            "Get API Key",
            "I already have one",
            () => { require("electron").shell.openExternal("https://makersuite.google.com/app/apikey"); },
            () => { console.log("[MessageScanAI] User chose to enter existing key."); }
        );
    }
getSettingsPanel() {
        return revenge.ui.buildSettingsPanel({
            settings: [
                {
                    type: "text",
                    id: "MessageScanAI_apiKey",
                    name: "Gemini API Key",
                    value: this.Settings.get("MessageScanAI_apiKey") || "",
                    placeholder: "Enter your Gemini API Key",
                    onChange: (val) => { this.Settings.set("MessageScanAI_apiKey", val); }
                }
            ]
        });
    }
};
