# Virtual Reality DOS (WIP)

http://sonictruth.github.io/vr-dos/

This is a experimental "PC running DOS" emulator inside a VR environment.

To achive this I modified js-dos to be able to compile it as a Web Worker.
This way the main thread will have enough power for VR rendering.

The VR environment was built using Three.js and the emulator is rendered inside the world using CanvasTexture.

![](demo.gif)

## Keys

On PC you can use your keyboard to control the emulator and mouse to look around.

In VR this are the default mappings (tested with Oculus Quest):

0: [Key.Enter], // Trigger

1: [Key.Shift], // Squeeze

3: [Key.Ctrl], // Joy fire

4: [Key.Space, Key.Shift, Key.Ctrl], // A

5: [Key.Ctrl, Key.Q, Key.Escape]  // B

## TODO
- Add sound support
- Add mouse support 
- Add Joystick support
- Optimize canvas drawing using OffscreenCanvas
- Optimize rendering loops, gamepad handling

## Credits
3D Model  https://sketchfab.com/railek

js-dos https://js-dos.com/
