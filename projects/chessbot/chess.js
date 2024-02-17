// Chess board in octal
const board = [
  0o70, 0o71, 0o72, 0o73, 0o74, 0o75, 0o76, 0o77, 0o60, 0o61, 0o62, 0o63, 0o64,
  0o65, 0o66, 0o67, 0o50, 0o51, 0o52, 0o53, 0o54, 0o55, 0o56, 0o57, 0o40, 0o41,
  0o42, 0o43, 0o44, 0o45, 0o46, 0o47, 0o30, 0o31, 0o32, 0o33, 0o34, 0o35, 0o36,
  0o37, 0o20, 0o21, 0o22, 0o23, 0o24, 0o25, 0o26, 0o27, 0o10, 0o11, 0o12, 0o13,
  0o14, 0o15, 0o16, 0o17, 0o00, 0o01, 0o02, 0o03, 0o04, 0o05, 0o06, 0o07,
];

// White pieces in octal - location 00
const whitePawn = 0o1100;
const whiteBishop = 0o1200;
const whiteRook = 0o1300;
const whiteKnight = 0o1400;
const whiteQueen = 0o1500;
const whiteKing = 0o1600;

// Black pieces in octal - location 00
const blackPawn = 0o2100;
const blackBishop = 0o2200;
const blackRook = 0o2300;
const blackKnight = 0o2400;
const blackQueen = 0o2500;
const blackKing = 0o2600;

// Legal moves without hindrances
// Pawns
const whitePawnMoves = 0o10;
const blackPawnMoves = -0o10;

// Bishops
const bishopMoves = [0o11, -0o11, 0o07, -0o07];

// Rooks
const rookMoves = [0o10, -0o10, 0o01, -0o01];

// Knights
const knightMoves = [
  0o21,
  0o17,
  -0o17,
  -0o21,
  +0o12,
  -0o12,
  -0o06,
  0o06,
];

// Queens
const queenMoves = [
  0o10,
  0o11,
  0o01,
  -0o07,
  -0o10,
  -0o11,
  -0o01,
  0o07,
];

// Kings
const kingMoves = [
  0o10,
  0o11,
  0o01,
  -0o07,
  -0o10,
  -0o11,
  -0o01,
  0o07,
];

function movePawn(pawn) {
  if (pawn < 0o20) {
    return whitePawnMoves;
  } else {
    return blackPawnMoves;
  }
}

function moveKnight() {}
