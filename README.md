# Virtual Reality DOS (WIP)

http://sonictruth.github.io/vr-dos/

This is an experimental "PC running DOS" emulator inside a VR environment.

The VR environment was built using Three.js and the emulator is rendered inside the world using CanvasTexture.

To achive proper fps (main thread needs a lot of cpu for VR rendering) I modified js-dos to be able to compile it as a Web Worker.



![](demo.gif)

## Keys

On PC you can use your keyboard to control the emulator and mouse to look around.

On mobile you can use the top right virtual keys.

In VR this are the default mappings (tested with Oculus Quest):

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
3D Model  https://sketchfab.com/railek

js-dos https://js-dos.com/
