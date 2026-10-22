# Discord Interaction Handler Bug Report

**Status:** RESOLVED (as of 2025-04-26 per Commander confirmation)

**Original Issue:** The logs below indicate repeated errors related to "Interaction secret missing or URL format incorrect" when the Supabase Edge Function `discord-interaction-handler` was invoked. This prevented Discord interactions (like slash commands) from working correctly.

**Resolution:** (Commander confirmed resolved, specific fix details not provided to AI.)

---
**Historical Log Data (Prior to Resolution):**

| event_message                                                                                                                              | event_type | function_id                          | id                                   | level | timestamp        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------ | ------------------------------------ | ----- | ---------------- |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 7b4e8f58-263a-4011-93fc-00b2eef21b5b | log   | 1744732069187725 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 0a5a40d1-0a93-463c-b35d-6ba06484fece | log   | 1744732067246335 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e0c987d4-360d-4b18-bc49-56f25eacefd8 | log   | 1744732060523858 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 9e7bc53f-c887-415a-8042-2bc76762734b | log   | 1744732060523589 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | b96229eb-4784-4f65-b62d-57cb4134bfa9 | log   | 1744732060523363 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | b62ef601-9b7f-4e83-8efb-0ab23d51b4f5 | log   | 1744732060523121 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 6a989cca-26e5-4c7e-a828-6f82f1e15b76 | log   | 1744732060522853 |
| booted (time: 30ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 73e90a98-5072-429a-9df2-0d1fa4517f68 | log   | 1744732060522547 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 973171f0-f8ec-485f-a688-9a5fa97b7ade | log   | 1744732060494758 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 7393ab17-508d-45b8-9046-d2c87a43f55b | log   | 1744732060494615 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 1f1a6454-71e5-4a1b-a171-41c31640487e | log   | 1744732060494412 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 926fe055-ccf5-406d-9067-d6ab30ca8df2 | log   | 1744732060494221 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 8cb8af0d-9b6c-47d6-8025-5b38dec847aa | log   | 1744732060494049 |
| booted (time: 24ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 319f9e31-6c60-45e9-b326-fa77a4e14009 | log   | 1744732060493868 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | a3e2340e-26f8-4a91-a266-4c9c61a164d4 | log   | 1744731918981361 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | fa41dd50-4f85-4938-8f50-ac770aa8a17f | log   | 1744731918981211 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 36c2a6a9-68fa-4d84-94b5-6f817e4b0d61 | log   | 1744731918981037 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 5ba7bfd9-02ad-4752-bcc3-6a504df41420 | log   | 1744731918980884 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e0f87333-9672-4334-9628-ce900ad174b2 | log   | 1744731918980671 |
| booted (time: 23ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 333ad4c6-6788-463d-be81-ae25c0056992 | log   | 1744731918980422 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 6e4939a7-0d34-4860-81a6-f055b2ad5592 | log   | 1744731918971705 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 7e28e5d7-f834-4a14-9f04-e7cfbda69de0 | log   | 1744731918971571 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e8303d90-69c7-4d1c-ab2a-9f7ef59d593a | log   | 1744731918971430 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | d61925de-8e6f-4240-93e6-9c3e51cedf2a | log   | 1744731918971303 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e9962a5c-f99a-4854-aeac-251ec765d478 | log   | 1744731918971169 |
| booted (time: 30ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | cb180703-fc9e-4caa-a765-b51fd33a032d | log   | 1744731918971015 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | d4d72937-02ad-48bc-996c-8d6c06e01093 | log   | 1744731901133616 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | a2701227-db66-4859-86df-766cee496637 | log   | 1744731899592534 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | f315e705-a06b-458c-aefc-9cf55820ee75 | log   | 1744731869139802 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | f7643352-0e32-4607-9928-a05f270d595e | log   | 1744731869137619 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 9f847ecf-4230-490e-84ee-7b4906b4564e | log   | 1744731869137470 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 456e2002-401c-4aa0-8d32-2db1dc817cd0 | log   | 1744731869137315 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | b5e6f523-1ee0-4e64-ac38-b851a0c059a2 | log   | 1744731869137138 |
| booted (time: 22ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 277b9fc0-355c-4a23-bd06-289578b8fd65 | log   | 1744731869136900 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | c649fb77-0f9b-4abf-a558-62843e9d7b3a | log   | 1744731867220048 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | df938d20-6ac3-47f7-afc2-303051febd3e | log   | 1744731867219857 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | ad1176ba-ccee-4876-8b5a-8550ab97c75c | log   | 1744731867219720 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e3a895f5-043b-495e-a8fa-83f0cb44c712 | log   | 1744731867219560 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e0970aae-f836-4318-a46a-e32827baca84 | log   | 1744731867219368 |
| booted (time: 23ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | fa673c15-a81b-4c44-85f0-235d2965765b | log   | 1744731867219151 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 4d72f5b4-682e-4258-964b-7c9a97b7d077 | log   | 1744731728477255 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | c0fc7caa-248d-4482-ae72-5455932fd4a3 | log   | 1744731725449693 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e58abe36-e408-4aba-8c4c-b4740d798a32 | log   | 1744731718021478 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | cd2d07f8-619e-4f8d-a29d-ad6b122e0d4a | log   | 1744731717008620 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | bbad69ed-8a2b-4338-8f65-d1bfb880d80a | log   | 1744731701059292 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 5687bf1f-adb9-4230-830c-dc12e33301b5 | log   | 1744731701059123 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 16fb1c2a-3243-4d72-9e52-09a495a87725 | log   | 1744731701058928 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | a3af5742-cead-4e2a-ac1d-78dd3a3198be | log   | 1744731701058734 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | b063a482-6269-4023-a75d-651df86c8062 | log   | 1744731701058536 |
| booted (time: 23ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | c75a90a8-cf77-4475-baa8-275099afc9ba | log   | 1744731701058156 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | bb5b7119-318f-4387-90dd-08e03d25196a | log   | 1744731699562121 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/f4CVxG5FuglLtDqPYBMgE2Js0e9p28dCYnTWR_hE7Rc
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | f6ef566f-8853-48f9-be5d-c05387acfb99 | log   | 1744731699561967 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 93a8ee80-7bde-4fec-9636-b17b8a3cfa0f | log   | 1744731699561824 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | f405fc96-e8d7-4e00-82b4-58b49f75523c | log   | 1744731699561695 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 38144920-d1d0-4be2-81ef-f05b9bd57266 | log   | 1744731699561564 |
| booted (time: 31ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 57359a56-ed16-44e6-b73d-8db4eac9b0f4 | log   | 1744731699561418 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 46b8cbf8-cf05-4772-878b-bee423ccc7b5 | log   | 1744731631078208 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 71f5f79b-9294-414a-8b7b-b7ad9802126a | log   | 1744731627295246 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | a702e37d-6442-48ae-9455-6b89da014c07 | log   | 1744731593136939 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | d55dca62-64fd-4c9f-ab1d-fc85371a0fef | log   | 1744731574075856 |
| shutdown                                                                                                                                   | Shutdown   | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 6f5943e7-3cbf-413d-829d-14e2e666cd9d | log   | 1744731572142216 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 75589361-5abe-4a05-8522-dad303a7a662 | log   | 1744731528427594 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 68844378-b7d0-4e5e-b13b-f9e49cc3f507 | log   | 1744731528427427 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 00d35685-fadc-445a-9fad-2eb86e00ae7b | log   | 1744731528427100 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 5b7423d7-a26a-4672-85c9-f428b0e0b48d | log   | 1744731528426894 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | d764442f-a931-4c92-afe1-0474fcfd03e8 | log   | 1744731528426751 |
| booted (time: 23ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 9b14ea0b-0dba-4ecc-84df-3064c8658071 | log   | 1744731528426594 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 216553f2-f98b-406b-94ca-5510b68d4bbe | log   | 1744731525401567 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | fdcccbb2-a718-4595-bacd-b552a7362a23 | log   | 1744731525401296 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 6377d4e5-f254-4fde-8ba0-b50d065f6027 | log   | 1744731525401060 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 7cccff8a-19c8-44fd-a1ec-8cce1e5042b3 | log   | 1744731525400784 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | d1c2ff77-5606-47bc-ab42-6669bfa47c91 | log   | 1744731525400572 |
| booted (time: 33ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | dd6c4a55-363a-4edf-a35e-5d1887f8d53b | log   | 1744731525400345 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e0037604-18dc-4995-aa60-c3afc7c18883 | log   | 1744731517982133 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | ebe1c1c1-5c31-4d74-b3be-e05470a973f5 | log   | 1744731517981923 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 1f78ccc0-6081-42b6-91e9-d0047e6b6807 | log   | 1744731517981694 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 705f1369-5faf-4124-8bed-23b3a58b0783 | log   | 1744731517981457 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 280d89fd-06f7-4cd3-b267-b5b6ca9a31f2 | log   | 1744731517981208 |
| booted (time: 22ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | b10677e5-003c-4a55-99ae-2c3aa7f2f8c9 | log   | 1744731517980924 |
| Responding to PING request.
                                                                                                               | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | c0ea65c5-d090-45cd-8ae9-e05be8fa561a | log   | 1744731516954156 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | e79d6fc9-c7f0-4a2f-a032-2244d89efb66 | log   | 1744731516953949 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 2d3c1943-46fa-4fb6-a136-139df7726f9a | log   | 1744731516953755 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 2443bb71-e722-444d-b78a-0835b4a7ab8a | log   | 1744731516953607 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 4054ac48-e825-4cb8-ab83-83fa56f9ce4a | log   | 1744731516953459 |
| booted (time: 23ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 237cbf11-f61c-4637-a6f7-bbc2c4883837 | log   | 1744731516953299 |
| Bad Request: Interaction secret missing or URL format incorrect. /discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
 | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 6672d23a-2cd2-4d51-8c6e-16d9508b129a | error | 1744731431029634 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 92611b9d-1e47-4917-ad30-70963a048f1c | log   | 1744731431029480 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 6e727502-6e15-4015-a636-cd0556b3eee1 | log   | 1744731431029316 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | dfc17da7-fac1-4188-8817-641279ae2f98 | log   | 1744731431029115 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | f04e3027-528a-450d-97f5-be0e77e830e5 | log   | 1744731431028860 |
| booted (time: 23ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 22feb76d-25d1-4d2e-8234-9bec3cafc9ba | log   | 1744731431028579 |
| Bad Request: Interaction secret missing or URL format incorrect. /discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
 | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 8bde0964-03ac-4631-8e77-77cac94a05e7 | error | 1744731427243839 |
| Received request: POST http://edge-runtime.supabase.com/discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | fd4fc9e0-f113-4fa9-aa1b-796d3c41a66f | log   | 1744731427243641 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | a4528259-cc8f-4193-91f9-d23c7ec71964 | log   | 1744731427243484 |
| Listening on http://localhost:9999/
                                                                                                       | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 1a1b5b9a-2ac8-4a09-b1c6-bc458275e003 | log   | 1744731427243297 |
| Initializing 'discord-interaction-handler' function...
                                                                                    | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 6f95eee9-e6f9-4dbe-8173-c3066b0be69a | log   | 1744731427243120 |
| booted (time: 23ms)                                                                                                                        | Boot       | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | bc0cd00e-8c9b-43ce-9c81-9e08d876bbf9 | log   | 1744731427242932 |
| Bad Request: Interaction secret missing or URL format incorrect. /discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
 | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | a977a980-f3d5-4b7e-a851-8dbdee823c3f | error | 1744731393072321 |
| Received request: GET http://edge-runtime.supabase.com/discord-interaction-handler/fo1ZtwztRKjxvEdPBxUpzovZ0RWS2Pu2ZjigIF8uhBY
            | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | a062509e-d776-4a39-a308-2091faeed286 | log   | 1744731393072180 |
| 'discord-interaction-handler' function started.
                                                                                           | Log        | da7503d9-20e9-4fd7-893f-9fe390c3d2f8 | 54889465-8e1d-4d0c-a010-e1333c9a4891 | log   | 1744731393072007 |