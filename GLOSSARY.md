# Glossary

## Bloom marker

The marker on a revealed safe tile. One plant carries a number of blooms equal
to the number of adjacent bombs. The blooms sit on one even ring, with one
bloom at the center when the count is one, and the ring widens as the count
grows. All blooms on the plant share the tile's canonical number color. Each
bloom has a pale cream center and a thin dark rim. A tile with no adjacent
bombs has no bloom marker.

## Petal litter

Fallen petals scattered around the base of a bloom marker, in the same
canonical color as the plant. Petal litter is the long-range color cue: it
identifies the number by color when the individual blooms are too small to
count. It does not encode a second count.

## Bomb mushroom

The marker on a revealed bomb tile. A large red-capped mushroom, roughly three
quarters of a tile wide and clearly taller than any bloom plant, standing in
red spore litter. The litter is a readability cue, not a count. Bombs are
revealed only when the game ends, so the mushroom is decorative and has no
distance count cue. It is deliberately not a flower, so it cannot be mistaken
for a bloom marker.

## Bomb reveal

The end of a lost game reveals every bomb tile. The reveal covers the whole
board, including chunks streamed in after the loss, so inspecting the map
never shows a mix of revealed and hidden bombs.

## Canonical Minesweeper palette

The traditional number colors: 1 blue, 2 green, 3 red, 4 navy, 5 maroon,
6 teal, 7 black, 8 gray. The bloom marker uses these hues without changing
their identity. Black and gray are lifted only enough to stay visible under
3D lighting.
