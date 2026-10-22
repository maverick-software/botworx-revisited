# Packaged workspace-agent concurrency and recovery

October 21, 2026. The isolated 0.44.52 candidate passed five concurrent-agent application workflows. This checkpoint initially retained installed 0.44.51 and left production unchanged. The same candidate image has since been [installed and ordinarily accepted as 0.44.52](installed-0.44.52.md). The concurrency checks retain their isolated-profile scope.

## What was exercised

The exact packaged application used its real PostgreSQL database, authentication, saved agent definitions, Codex 0.163.0 threads, queue, steering controls and encrypted drafts. Five generated specialists started independent turns at the same time. Their model responses were controlled and initially held so that navigation, cancellation and steering could be exercised while all five were working. This did not use paid inference or external tool actions.

The verifier arranged the generated chats through the broker, then loaded that arranged state into the renderer. The measured navigation used actual sidebar clicks. One chat received an unsent draft; another received a queued follow-up through the actual composer and Enter key. Stop and steering used the same broker operations as their product controls. The app then closed normally while its final chat was still unfinished and reopened the same separate F: profile/runtime.

## Established results

- Five requests reached five distinct actual Codex threads concurrently. They all reached their held model response within 10.85 seconds.
- The five measured sidebar navigations took 0.15–0.88 seconds, below the five-second limit declared before testing. Navigating away preserved the separate chat's draft.
- Stopping one request took about 1.91 seconds. The four other turns remained active.
- Steering was acknowledged in about 1.09 seconds. Codex cancelled its previous response stream and processed the revised input within the same thread and turn. The response guard required that steering text in the next model input before returning the confirmed result.
- The queued follow-up ran once after its original response completed and reused that chat's Codex thread. Its guard required the queued text in the actual model input.
- Normal closure cancelled the remaining unfinished request. Reopening retained the completed and steered results, the completed queued follow-up and the independent unsent draft. The unfinished response stayed stopped, with no fabricated completed reply. The cold reopening made zero model requests.

The machine was Windows build 26200, x64, Intel Core i7-12700K with twenty logical processors and about 63.8 GiB usable physical memory. The declared limits were ninety seconds to start all turns, five seconds for each measured navigation and ten seconds for each control. These measurements describe this machine and workload. Free-memory samples include other system activity and are not an isolated memory-cost measurement.

## Evidence and verifier corrections

Qualification: `F:/Agentopia/.supabase/desktop-composio-candidate52/1792560932895/concurrent-agents-qualification.json`. It records the frozen application hash, support-script hashes, actual network-routing records, observed thresholds and three inspected packaged screenshots. The successful workflow evidence is `F:/Agentopia/.supabase/desktop-composio-candidate52/1792560932895/concurrent-agents-1792563628866/evidence.json`. Both packaged processes closed normally and the owned test runtime was stopped afterward.

Earlier verifier attempts are retained. They initially used full-page navigation instead of the sidebar's draft-flushing path, tried sidebar navigation before the broker-arranged chats were loaded into renderer history, tried releasing a stream already cancelled by steering, and polled the queued request before asynchronous dispatch created its database row. The verifier was corrected for those conditions without changing product code or the frozen image. Before fresh controlled requests, saved prior request states were checked. A completed steered response was retained, and an unfinished queue remained held after closure; that generated held queue was explicitly removed. Completed request IDs were not replayed.

## Limits and next work

These are five overlapping native turns using controlled, held model responses. They establish the tested state transitions and responsiveness, rather than five simultaneous heavy builds or hours of live inference. Extended unattended/concurrent workloads, Windows reboot, another Windows-user restore and fresh reference-app comparison remain separate open checks. Earlier live identity, procedures, skill use, private memory and delegation evidence remains in [agent health](agent-health-0.44.50.md). Real Composio project setup and authentication/action verification remain open; installation of the unconfigured setup is complete in [the integration report](composio-source-integration.md). The full parity and persistent workspace-agent goal remains active and incomplete.

Later verification on installed62 exercised the five-chat workload with real ChatGPT responses, actual Stop/Steer buttons, a composer-queued follow-up and cold reopening. It preserved six completed or deliberately stopped application requests, backed by seven provider responses, without inference replay. The test needed to release its pre-header response hold before native steering advanced; it does not establish interruption timing for an already streaming live response. See [actual five-chat controls62](live-concurrency62.md) for the results and limits.
