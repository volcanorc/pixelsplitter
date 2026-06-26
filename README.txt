32x32 Minecraft Image Slicer

How to run:
1. Double-click start-local.cmd.
2. The site opens at http://127.0.0.1:5173/.
3. Close the command window to stop the local site.

The launcher uses Node.js if it is available. If Node.js is not installed, it
automatically falls back to a built-in Windows PowerShell server.

How to use:
1. Upload or drag in an image. You can drop it on the upload box or the preview canvas.
2. Use the Image size slider to scale the working image down proportionally.
3. Use the Tile count slider for quick square crops like 1x1, 2x2, and 3x3.
4. Move or resize the border manually for rectangular exports. Width and height always export in exact 32px steps.
5. Click Download ZIP to save all 32x32 PNG tiles.
6. Scroll over the preview to zoom. Hold Space and drag to pan around.
7. When the crop reaches the maximum 32px grid width, the left and right border turn yellow.
8. When the crop reaches the maximum 32px grid height, the top and bottom border turn yellow.
9. Green border sides mean that axis can still expand.

For a 209x209 image, the default selection is 192x192, which exports 36 tiles.
Tiles are named 1.png, 2.png, 3.png, and so on from left to right, top to bottom.

GitHub Pages:
https://volcanorc.github.io/pixelsplitter/
