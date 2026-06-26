# muscle-memory headline demo — replicates Hermes-style skill distillation, Letta-native.
# Render: vhs docs/demo.tape  (run from the package root)
Output docs/demo.gif
Output docs/demo.mp4
Output docs/demo.webm

Set Shell "bash"
Set FontSize 18
Set Width 1280
Set Height 760
Set Padding 26
Set Theme "Catppuccin Mocha"
Set TypingSpeed 0ms
Set PlaybackSpeed 1.0

Hide
Type "clear && node scripts/demo-reel.mjs"
Enter
Show
Sleep 1s

# Let the reel play its full ~24s course
Sleep 30s
