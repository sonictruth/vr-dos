# Virtual Reality DOS PoC

http://sonictruth.github.io/vr-dos/

This is an experimental emulator for a "PC running DOS" within a VR environment.
The VR environment was constructed using Three.js, and the emulator was rendered within this world using CanvasTexture.
The main challenge was achieving good FPS, as the main thread required a significant amount of CPU for VR rendering.
Therefore, I modified JS-Dos to enable its compilation as a Web Worker.

![](demo.gif)

## Keys

You can use your keyboard to control the emulator on your PC, and your mouse to look around.
You can use the virtual keys at the top right on mobile.
These are the default mappings in VR (tested with Oculus Quest):

0: [Key.Enter], // Trigger

1: [Key.Shift], // Squeeze

3: [Key.Ctrl], // Joystick press 

4: [Key.Space, Key.Shift, Key.Ctrl], // A

5: [Key.Ctrl, Key.Q, Key.Escape]  // B

## TODO
- Add sound support
- Add mouse support 
- Add Joystick support
- Optimize canvas drawing using OffscreenCanvas
- Optimize rendering loops, gamepad handling

## Credits
3D Model 
https://sketchfab.com/railek
js-dos
https://js-dos.com/
