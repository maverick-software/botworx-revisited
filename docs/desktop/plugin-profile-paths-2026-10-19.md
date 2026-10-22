# Plugin review paths in the Windows application

The full32 application rehearsal finds a real plugin-review failure after18 successful platform workflow groups. The UI reports “The private plugin skill directory changed” and keeps installation disabled. The frozen image remains unchanged and is marked ineligible for installer preparation. The installed ordinary24 application is unchanged.

## Cause and direct comparisons

In this launch context, Windows redirects the logical profile to the Codex package's physical Roaming directory. The profile leaf is an ordinary directory, not a symbolic link. Its logical path is94 characters; its physical path is147. `NativePluginSkills` previously required the supplied logical spelling to equal `realpath` before it could create private review/cache directories, so validation stopped before Codex could load the skill.

Changing only the supplied root to its physical spelling gets past that guard but produces a287-character working directory under the former owner/stage/home layout. A direct Windows process comparison launches the same pinned `codex --version` successfully from an86-character directory and rejects the287-character working directory with “The directory name is invalid.” A plain Node validation probe also retains its `ENOTCONN` subprocess failure. That failed probe is preserved; it is not a successful native validation.

## Source correction

The service now resolves only its trusted host profile root and pins the resulting path, device and directory identity. It rejects an explicitly linked profile leaf and any later replacement of that profile. Cache folders, receipts and package files below the pinned physical root retain their strict link/path/content checks. Cache removal still waits for the matching in-flight setup and checks the owned cache directory before removing derived data.

Temporary native reviews use a compact `skill-reviews/_stage-<random UUID>` directory directly below that private profile. The temporary directory is also `CODEX_HOME`, while package files and the working directory remain separate children. A147-character physical profile produces a201-character native home and a211-character working directory. Review paths retain the full random UUID and stay inside protected profile storage. Windows homes beyond the supported210-character limit fail before starting a subprocess. Temporary package receipts still identify the account and exact package, and only the captured stage is removed.

## Verification and retained failures

The new alias/cache regression fails against frozen32 with the same private-directory error. The corrected source passes six profile checks: trusted alias resolution and removal, actual Codex validation at the147-character physical root, cache-link refusal, profile replacement refusal, explicit profile-leaf link refusal, and concurrent account review/cancellation isolation. Fifty-five existing plugin import, native reference/helper, update, child, cache-removal and policy checks also pass. The actual redirected profile from the failed application validates the same generated package through pinned Codex, returns all three reviewed files, clears its new staging directory and leaves the helper marker absent. No inference is submitted.

Source qualification is `C:/Users/charl/AgentopiaQA/plugin-profile-fix/1792386715321/evidence.json`; source acceptance is `source-acceptance.json` beside it. The first source qualification retains a test setup failure: compiling outside the repository left its dependency search path unresolved. The final controller keeps its small compiled output under the repository and stores the larger evidence on C:. The earlier five-check source pass is also retained; the final six-check run adds account review isolation.

The failed full application is retained at `C:/Users/charl/AgentopiaQA/plugin-compatibility/1792385923176`. Its private runtime is stopped and remains registered for investigation. It holds no paid requests. A separate test-observer issue failed to strip a byte-order mark from PowerShell's JSON, which prevented its ready check from accepting the process handle. The raw Windows observation records main-process exit0. The observer reader is corrected in the test controller and its error is now retained explicitly; the failed rehearsal is not relabeled as passed.

## Remaining delivery

These are source-qualified changes to native skill storage. A new immutable candidate must include them and pass the full Windows import, SQL assignment, chat-use and cold-reopening checks. The61 source checks do not establish that full application outcome. Candidate32's earlier381 backend and36 interface successes remain valid within their recorded scope, but they do not override its failed application test. No32 installer is prepared or installed, and full desktop parity remains incomplete.
