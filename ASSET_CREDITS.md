# Asset credits

All models below are CC0 1.0 (public domain dedication). Credit is not required,
but is recorded here for provenance. Every file is a self-contained `.glb`;
where a source shipped texture files separately, they were embedded into the
GLB. No model files were generated with AI.

| Target file | Source model | Pack | Author | Source URL | License |
| --- | --- | --- | --- | --- | --- |
| `src/assets/markers/lighthouse.glb` | Light House | Standalone upload (no named pack) | MaverickFX | https://poly.pizza/m/KRebJXIRb8 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/pine.glb` | Pine (`Pine_5`) | Ultimate Stylized Nature Pack | Quaternius | https://poly.pizza/m/igSu0cPoBz | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/oak.glb` | Tree (`CommonTree_1`) | Ultimate Stylized Nature Pack | Quaternius | https://poly.pizza/m/qZtx0AHhcy | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/chimney.glb` | Chimney Large | City Kit Industrial | Kenney | https://kenney.nl/assets/city-kit-industrial (downloaded via https://hydecogames.com/art/packs/kenney-city-kit-industrial/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/windmill.glb` | Windmill (`Windmill_SecondAge`) | Ultimate Fantasy RTS | Quaternius | https://poly.pizza/m/WUbU1Nct2W | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/tower.glb` | Antenna (`Antenna_2`) | Standalone upload (no named pack) | Quaternius | https://poly.pizza/m/OuHQCigiUR | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/silo.glb` | Silo | Farm Buildings Bundle | Quaternius | https://poly.pizza/m/5GhLrv5Ce3 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/village.glb` | House | Standalone upload (no named pack) | Quaternius | https://poly.pizza/m/YlADpCJU8U | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/waterTower.glb` | Water Tower | Standalone upload (no named pack) | Quaternius | https://poly.pizza/m/tMK8bhapAK | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/barn.glb` | Barn | Farm Buildings Bundle | Quaternius | https://poly.pizza/m/vSqQNA7ez6 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/markers/pylon.glb` | Transmission Tower (`Tower_1`) | Transmission Lines Collection | iPoly3D | https://poly.pizza/m/TYK3rPu7E5 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Decorations all come from one kit, so their style and scale stay consistent:

| Target file | Source model | Pack | Author | Source URL | License |
| --- | --- | --- | --- | --- | --- |
| `src/assets/nature/kenney_tree.glb` | Tree | Nature Kit | Kenney | https://poly.pizza/m/QN3Ru02ayU | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/nature/kenney_treeLarge.glb` | Tree Large | Nature Kit | Kenney | https://poly.pizza/m/ORCbG8dslS | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/nature/kenney_rock.glb` | Rock | Nature Kit | Kenney | https://poly.pizza/m/96WFhOKCXK | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/nature/kenney_rockFlat.glb` | Rock Flat | Nature Kit | Kenney | https://poly.pizza/m/CrSoV13mCU | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/nature/kenney_plant.glb` | Plant Small | Nature Kit | Kenney | https://poly.pizza/m/4f6vwL8vo9 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/nature/kenney_twig.glb` | Twig | Nature Kit | Kenney | https://poly.pizza/m/xApCbtFYP8 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/nature/kenney_mushroom.glb` | Mushroom | Nature Kit | Kenney | https://poly.pizza/m/A2rwQyfqYG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/nature/kenney_grass.glb` | Grass | Nature Kit | Kenney | https://poly.pizza/m/uEgE0AfnPF | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Terrain detail comes from a CC0 grass material. The colour map was converted
to a bright, low-contrast neutral detail map so it multiplies the existing
grass, rock and snow vertex colours instead of repainting them:

| Target file | Source map | Pack | Author | Source URL | License |
| --- | --- | --- | --- | --- | --- |
| `src/assets/textures/grass_detail.png` | Grass 005 1K Color (`Grass005_1K-JPG_Color.jpg`) | Grass 005 | ambientCG | https://ambientcg.com/a/Grass005 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/textures/farm_furrows.jpg` | Farm Furrows 1K Diffuse (`farm_furrows_diff_1k.jpg`) | Farm Furrows | Poly Haven | https://polyhaven.com/a/farm_furrows | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Notes on processing:

- `chimney.glb`: the Kenney GLB referenced `Textures/colormap.png` externally;
  that texture is now embedded in the GLB. Source pack license text is
  available at https://kenney.nl/assets/city-kit-industrial.
- `lighthouse.glb`: the original 2048x2048 embedded texture was downscaled to
  512x512 to keep the file small.
- `pine.glb` and `oak.glb`: the original 1024x1024 embedded textures were
  downscaled to 256x256 to keep the files small.
- `grass_detail.png`: the Grass 005 colour map was resized to 512x512,
  autocontrasted, converted to neutral grayscale and remapped to 220–255.
- `farm_furrows.jpg`: the Poly Haven diffuse map was resized to 512x512 and
  brightened slightly so the parallel furrows stay readable at tile scale.
- All other files were copied unchanged from the source GLB.
