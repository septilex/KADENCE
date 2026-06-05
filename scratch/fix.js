const fs = require('fs');
let code = fs.readFileSync('components/ui/IntroScreen.tsx', 'utf8');

code = code.replace(
  'className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent pointer-events-auto overflow-hidden"',
  'className="fixed inset-0 z-50 bg-transparent pointer-events-auto overflow-y-auto overflow-x-hidden scrollbar-hide"\\n        style={{ scrollBehavior: \\'smooth\\' }}'
);
code = code.replace(
  'kadence-particle absolute rounded-full',
  'kadence-particle fixed rounded-full'
);
code = code.replace(
  'className="absolute inset-0 pointer-events-none"\\n              initial={{ opacity: 0 }}',
  'className="fixed inset-0 pointer-events-none"\\n              initial={{ opacity: 0 }}'
);
code = code.replace(
  'className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-950/20 blur-[120px] pointer-events-none"',
  'className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-950/20 blur-[120px] pointer-events-none"'
);
code = code.replace(
  'className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-950/15 blur-[100px] pointer-events-none"',
  'className="fixed bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-950/15 blur-[100px] pointer-events-none"'
);

code = code.replace(
  "          {step === 'vibe' && (\\n            <motion.div\\n              key=\\"step-vibe\\"\\n              className=\\"relative z-10 flex flex-col items-center gap-10 px-6 max-w-4xl w-full\\"\\n              initial={{ opacity: 0, y: 40 }}",
  "          {step === 'vibe' && (\\n            <motion.div\\n              key=\\"step-vibe-container\\"\\n              className=\\"relative w-full min-h-[calc(100dvh+350px)]\\"\\n              initial={{ opacity: 0 }}\\n              animate={{ opacity: 1 }}\\n              exit={{ opacity: 0 }}\\n              transition={{ duration: 0.7 }}\\n            >\\n              {/* EXACT ORIGINAL HERO LAYOUT */}\\n              <motion.div\\n                className=\\"absolute top-[50dvh] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-10 px-6 max-w-4xl w-full\\"\\n                initial={{ opacity: 0, y: 40 }}"
);

code = code.replace(
  "                  )\\n                })}\\n              </div>\\n\\n              {/* Creator Collection Section */}",
  "                  )\\n                })}\\n              </div>\\n              </motion.div>\\n\\n              {/* Creator Collection Section */}"
);

code = code.replace(
  'className="absolute top-full left-1/2 -translate-x-1/2 mt-4 flex flex-col items-center w-full px-4"',
  'className="absolute top-[calc(50dvh+340px)] left-1/2 -translate-x-1/2 flex flex-col items-center w-full px-6 pb-24"'
);
code = code.replace(
  '<h3 className="text-[#d4af37] text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase">Creator Collection</h3>',
  '<h3 className="text-[#d4af37] text-xs md:text-sm font-bold tracking-[0.25em] uppercase">Creator Collection</h3>'
);
code = code.replace(
  'className="relative group flex flex-col justify-end p-4 rounded-[12px] overflow-hidden cursor-pointer text-left outline-none w-full max-w-[420px] h-[90px] border border-[#d4af37]/40 mx-auto shadow-xl"',
  'className="relative group flex flex-col justify-end p-6 rounded-[16px] overflow-hidden cursor-pointer text-left outline-none w-full max-w-[360px] h-[200px] border border-[#d4af37]/50 mx-auto shadow-2xl"'
);

code = code.replace(
  "? '0 0 30px rgba(212,175,55,0.4), inset 0 0 20px rgba(212,175,55,0.15)' \\n                          : '0 0 15px rgba(212, 175, 55, 0.1)',\\n                        transform: isActive ? 'scale(1.02)' : 'scale(1)',\\n                        filter: isActive ? 'brightness(1.1)' : 'brightness(1)'",
  "? '0 0 60px rgba(212,175,55,0.6), inset 0 0 40px rgba(212,175,55,0.2)' \\n                          : '0 0 25px rgba(212, 175, 55, 0.15)',\\n                        transform: isActive ? 'scale(1.03)' : 'scale(1)',\\n                        filter: isActive ? 'brightness(1.15)' : 'brightness(1)'"
);

code = code.replace(
  'bg-gradient-to-r from-transparent via-[#d4af37]/10 to-transparent -translate-x-full group-hover:animate-[kadence-progress-shimmer_2s_infinite]',
  'bg-gradient-to-r from-transparent via-[#d4af37]/25 to-transparent -translate-x-full group-hover:animate-[kadence-progress-shimmer_1.5s_infinite]'
);

code = code.replace(
  'text-[100px] font-black text-[#d4af37] opacity-10 tracking-tighter',
  'text-[120px] font-black text-[#d4af37] opacity-[0.08] tracking-tighter'
);

code = code.replace(
  '<div className="absolute top-4 right-4',
  '<div className="absolute top-5 right-5'
);

code = code.replace(
  'className="relative z-10 w-full mt-auto translate-y-1 group-hover:translate-y-0 transition-transform duration-400">\\n                        <span\\n                          className="block text-white font-bold text-sm md:text-base leading-tight mb-0.5"',
  'className="relative z-10 w-full mt-auto translate-y-2 group-hover:translate-y-0 transition-transform duration-400">\\n                        <span\\n                          className="block text-white font-bold text-lg md:text-xl leading-tight mb-1"'
);

code = code.replace(
  '<div className="flex items-center gap-2">\\n                          <span className="text-white/70 text-[9px] uppercase font-bold tracking-wider leading-tight">\\n                            {devSpecialVibe.sub}\\n                          </span>\\n                          <span className="text-[#d4af37] text-[9px] font-bold tracking-[0.1em] uppercase">',
  '<div className="flex items-center gap-2 mt-1">\\n                          <span className="text-white/70 text-[10px] md:text-xs uppercase font-bold tracking-wider leading-tight">\\n                            {devSpecialVibe.sub}\\n                          </span>\\n                          <span className="text-[#d4af37] text-[10px] md:text-xs font-bold tracking-[0.1em] uppercase">'
);

code = code.replace(
  "{step === 'loading' && (\\n            <motion.div\\n              key=\\"step-loading\\"\\n              className=\\"relative z-10 flex flex-col items-center gap-8 px-6 max-w-sm w-full text-center\\"\\n              initial={{ opacity: 0, y: 30 }}",
  "{step === 'loading' && (\\n            <div key=\\"step-loading-container\\" className=\\"absolute top-[50dvh] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center\\">\\n              <motion.div\\n                key=\\"step-loading\\"\\n                className=\\"relative z-10 flex flex-col items-center gap-8 px-6 max-w-sm w-full text-center\\"\\n                initial={{ opacity: 0, y: 30 }}"
);

code = code.replace(
  "                  </p>\\n                </div>\\n              </div>\\n            </motion.div>\\n          )}",
  "                  </p>\\n                </div>\\n              </div>\\n              </motion.div>\\n            </div>\\n          )}"
);

fs.writeFileSync('components/ui/IntroScreen.tsx', code);
