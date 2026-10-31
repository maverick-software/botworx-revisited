# Chat progress and composer focus update

Installed on October 26, 2026 as an interface update to Agentopia 0.44.84.

The agent builder textarea inherited the general input focus shadow inside its rounded composer. A scoped focus rule removes that inner shadow while retaining the composer's focus border and visible keyboard focus on its buttons. It applies to the creation prompt and the editor sidebar.

Ordinary chat and the agent builder now place a shared elapsed work summary above the assistant notes, with a horizontal separator beneath it. Current activity appears below the latest note, using recorded tool and approval states or Thinking while the model continues. Completed turns remove the live indicator and retain their recorded duration. Work and activity status use the same 13 px size; builder notes use the same configured message size as ordinary chat. Existing tool history and approval controls remain accessible.

Verification used the actual React components with controlled local replies, followed by the actual packaged renderer. Eight focused scenarios covered placement, font sizes, separators, tool completion, approval visibility, builder notes, configuration JSON suppression, focus in both layouts and themes, completion timing, and history disclosure. The existing sixteen creator scenarios also passed, including draft recovery, saved assignments, late replies, account changes and explicit Save/Create behavior. TypeScript checking passed. Verification submitted no live model requests.

The installed ordinary chat was inspected after a normal close and reopen. The divider appears beneath Worked for and the saved conversation remains available. Every original row across all 144 application tables was preserved. The strict encrypted-settings comparison preserved all provider connections and other settings; it accepted only a verified local sign-in session renewal. Image generation remains disabled. All six core services were healthy.

The program archive, native helper, backend resources, dependencies and database schema are unchanged. The installed archive SHA-256 remains `a6d739387e5c434a724f274648eddfde97d3dce32f70dd8b8821847e2887f48c`. The interface source is committed through `c7c3fa3` on `codex/plugin-skills-settings`.

Local delivery records:

- Package proof: `F:/Agentopia/.supabase/desktop-builder-focus86/1793032496061/package-proof.json`
- Focus and packaged-style qualification: the same directory's `qualification.json`
- Focused interface evidence: `F:/Agentopia/.supabase/turn-progress86-ui/1793032383179/evidence.json`
- Creator regression evidence: `F:/Agentopia/.supabase/agent-creator85-ui/1793032095286/evidence.json`
- Installation, encrypted recovery backup, database and credential comparison, and completion: `F:/Agentopia/.supabase/desktop-release84/1793027490229/installation-1793032555913/`

The fresh recovery archive and previous interface are retained. Installation replaced only the active interface directory and did not run the application updater or database migrations. Earlier delivery records remain historical evidence.
