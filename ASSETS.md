# Asset provenance

Public authorship: **An interactive narrative by Mark Mathew.** These assets were created for The Counter and are bundled for local playback. No external image, sound or font is fetched during gameplay.

## Original artwork

Codex's built-in image generation tool created the fictional restaurant, customer poses, queue figures, foreground, package and speaker portraits. Source PNGs are in `assets/source/`; their 17 runtime WebPs are in `public/art/`. Sharp performs optional build-time compression. No real-person likeness references, external stock photographs or purchased asset packs were used.

The original prompts, identity-preserving edits, reference relationships and encoding provenance are preserved:

- [Environment and initial assets](assets/prompts.json)
- [Initial customer poses](assets/pose-prompts.json)
- [Chapter II](assets/chapter2-prompts.json)
- [Additional queue figures](assets/v0.3.1-prompts.json)
- [Speaker portraits](assets/speaker-portraits-provenance.json)

Menu text, clocks, terminal states, receipts, interface icons and favicon are authored HTML/CSS/SVG. Fonts use the operating system's Georgia and Segoe UI/Arial stacks; no font files are distributed.

## Speech, ambience and foley

`public/audio/dialogue/` contains 60 saved, authored-caption recordings generated locally using **kokoro-js 1.2.1**, **onnx-community/Kokoro-82M-v1.0-ONNX**, q8, stock synthetic voice embeddings. No real-person recording or voice-cloning input was supplied. The [dialogue manifest](assets/dialogue-provenance.json) records the exact text, voice settings, sample rate, duration and model/output hashes.

The authoring software/model declare Apache-2.0 licensing; the [original license notice](assets/licenses/Kokoro-Apache-2.0.txt) is included. Sources: [model card](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX), [Kokoro source](https://github.com/hexgrad/kokoro), [kokoro-js](https://www.npmjs.com/package/kokoro-js/v/1.2.1). No synthesis model, embedding or inference SDK runs in the browser, and no model weights are included in the repository.

The two legacy `public/audio/order-call.wav` and `murmur.wav` recordings were synthesized locally using Microsoft Zira Desktop from authored order-call/background text. The optional Windows generation script requires an installed Windows speech voice; no Microsoft software or voice model is redistributed. The current conversation uses the saved Kokoro clips above.

`src/audio/Soundscape.ts` implements original procedural kitchen hum, fixed-seed noise, footsteps, printer, paper and chime. No third-party field recordings or music are used.

## Rights notice

No project-wide open-source license is assigned to this release. Third-party notices retain their own scope. The source images, prompts and generated recordings document the production assets; they do not imply rights to redistribute the authoring models or operating-system voices themselves.
