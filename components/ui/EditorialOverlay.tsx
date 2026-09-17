import { motion } from 'framer-motion'

export function EditorialOverlay() {
  // Shared chrome/silver gradient style for quote and footer
  const metallicTextClass = "text-transparent bg-clip-text bg-gradient-to-b from-[#eef0f2] via-[#a8aeb5] to-[#6b727a] drop-shadow-sm"

  return (
    <div className="absolute left-[400px] right-0 top-0 bottom-0 pointer-events-none z-10 flex flex-col items-center justify-center">
      {/* Centered Editorial Content */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center text-center mt-14"
      >
        <h1 
          className="flex flex-col items-center gap-4 sm:gap-5 uppercase font-bold text-base sm:text-lg text-transparent bg-clip-text bg-gradient-to-b from-white via-[#d4d9df] to-[#8c949e] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] opacity-100 select-none"
          style={{
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '0.85em',
            marginRight: '-0.85em',
          }}
        >
          <span>MUSIC</span>
          <span>BEYOND</span>
          <span>BORDERS</span>
        </h1>
        
        {/* Divider */}
        <div className="w-12 h-[1px] my-10 bg-gradient-to-r from-transparent via-[#a8aeb5] to-transparent opacity-30 shadow-sm" />
        
        <div className="flex flex-col items-center gap-5">
          <p className={`font-serif italic tracking-wider text-[13px] sm:text-[15px] opacity-100 ${metallicTextClass}`}>
            “Same beats. A bigger world.”
          </p>
          <p className={`text-[9px] uppercase tracking-[0.4em] font-medium opacity-100 ${metallicTextClass}`}>
            — KADENCE
          </p>
        </div>
      </motion.div>

      {/* Bottom Right Editorial */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 1 }}
        className="absolute bottom-12 right-0 flex items-center opacity-60"
      >
        <span className={`text-[11px] sm:text-xs uppercase tracking-[0.5em] font-medium pr-5 ${metallicTextClass}`}>
          India × Global × You
        </span>
        <div className="w-16 h-[1px] bg-gradient-to-r from-[#a8aeb5] to-transparent opacity-40" />
      </motion.div>
    </div>
  )
}
