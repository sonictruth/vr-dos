# Virtual Reality DOS

http://sonictruth.github.io/vr-dos/

Experimantal DOS emulator inside a VR environment.
To achive this I modified js-dos to be able to compile it it as a Web Worker
This way the main thread will have enough power for VR rendering.

![](demo.gif)

## Keys

On PC you can use your keyboard to control the PC and mouse to look around.

In VR this are the default mappings (tested with Oculus Quest):

0: [Key.Enter], // Trigger
1: [Key.Shift], // Sqeeze
3: [Key.Ctrl], // Joy fire
4: [Key.Space, Key.Shift, Key.Ctrl], // A
5: [Key.Ctrl, Key.Q, Key.Escape]  // B

## TODO
- Add soumd
- Add mouse support 
- Add Joystick support
- Optimize canvas drawing using OffscreenCanvas

## Credits
3D Model  https://sketchfab.com/railek
js-dos https://js-dos.com/
