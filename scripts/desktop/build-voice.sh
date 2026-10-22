#!/usr/bin/env bash
set -euo pipefail
repo="$1"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq cmake g++ ca-certificates curl > /tmp/agentopia-voice-build-deps.log
work=/tmp/agentopia-whisper-v1.9.5
mkdir -p "$work/source" "$work/bundle"
curl -fL --retry 3 https://api.github.com/repos/ggml-org/whisper.cpp/tarball/v1.9.5 -o "$work/source.tar.gz"
tar -xzf "$work/source.tar.gz" -C "$work/source" --strip-components=1
cmake -S "$work/source" -B "$work/build" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF -DWHISPER_BUILD_TESTS=OFF -DCMAKE_EXE_LINKER_FLAGS='-static-libgcc -static-libstdc++'
cmake --build "$work/build" --target whisper-cli -j 4
cp "$work/build/bin/whisper-cli" "$work/bundle/whisper-cli"
cp "$work/source/LICENSE" "$work/bundle/LICENSE-whisper.cpp"
python3 - "$work/bundle" <<'PY'
import hashlib,json,pathlib,sys,urllib.request
root=pathlib.Path(sys.argv[1])
info=json.load(urllib.request.urlopen('https://huggingface.co/api/models/ggerganov/whisper.cpp'))
revision=info['sha']
entries=json.load(urllib.request.urlopen('https://huggingface.co/api/models/ggerganov/whisper.cpp/tree/'+revision+'?expand=true&limit=100'))
entry=next(e for e in entries if e['path']=='ggml-base.en.bin')
expected=entry['lfs']['oid'];url='https://huggingface.co/ggerganov/whisper.cpp/resolve/'+revision+'/ggml-base.en.bin'
target=root/'ggml-base.en.bin'
urllib.request.urlretrieve(url,target)
assert hashlib.sha256(target.read_bytes()).hexdigest()==expected,'Whisper model checksum failed'
manifest={'whisper':'v1.9.5','model':'base.en','modelRevision':revision,'modelSHA256':expected,'modelSource':url,'license':'MIT'}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
PY
curl -fL --retry 3 https://raw.githubusercontent.com/openai/whisper/main/LICENSE -o "$work/bundle/LICENSE-model"
mkdir -p "$repo/desktop/resources"
tar -czf "$repo/desktop/resources/voice.tar.gz" -C "$work/bundle" .
sha256sum "$repo/desktop/resources/voice.tar.gz" | cut -d' ' -f1 > "$repo/desktop/resources/voice.sha256"
cp "$work/source/samples/jfk.wav" "$repo/.supabase/desktop-poc/voice-test.wav"
echo 'Prepared bundled local Whisper voice runtime.'
