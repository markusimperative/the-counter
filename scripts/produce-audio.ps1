$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$counterProjectRoot = Split-Path -Parent $PSScriptRoot
$counterAudioRoot = Join-Path $counterProjectRoot 'public\audio'
New-Item -ItemType Directory -Path $counterAudioRoot -Force | Out-Null
$counterSynth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    $counterSynth.SelectVoice('Microsoft Zira Desktop')
    $counterFormat = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(
        24000,
        [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
        [System.Speech.AudioFormat.AudioChannel]::Mono
    )
    $counterSynth.Volume = 80
    $counterSynth.Rate = 0
    $counterSynth.SetOutputToWaveFile((Join-Path $counterAudioRoot 'order-call.wav'), $counterFormat)
    $counterSynth.Speak('Order forty-seven. Ready for collection.')
    $counterSynth.SetOutputToNull()
    $counterSynth.Volume = 60
    $counterSynth.Rate = -2
    $counterSynth.SetOutputToWaveFile((Join-Path $counterAudioRoot 'murmur.wav'), $counterFormat)
    $counterSynth.Speak('There is a table by the window. I will get the coffees. Did you want something for lunch? That looks lovely. We can sit over there. I think the rain has stopped. See you after the meeting.')
    $counterSynth.SetOutputToNull()
    Get-ChildItem -LiteralPath $counterAudioRoot | Select-Object Name, Length
} finally {
    $counterSynth.Dispose()
}
