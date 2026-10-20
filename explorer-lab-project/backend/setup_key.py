"""Run once:  python setup_key.py   (creates the .env file for you)"""
print("Paste a FREE key. You can use Gemini, Groq, or both. Press Enter to skip one.")
print("  Gemini key: https://aistudio.google.com/apikey")
print("  Groq key:   https://console.groq.com/keys")
g = input("Gemini key: ").strip()
q = input("Groq key:   ").strip()
open(".env", "w").write(f"GEMINI_API_KEY={g}\nGROQ_API_KEY={q}\n")
print("Done! Now run:  python app.py")
