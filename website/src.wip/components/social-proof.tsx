const TOOLS = [
	{ name: "OpenCode", flag: "--opencode" },
	{ name: "OpenClaw", flag: "--openclaw" },
	{ name: "Crush", flag: "--crush" },
	{ name: "Goose", flag: "--goose" },
	{ name: "Aider", flag: "--aider" },
	{ name: "Continue", flag: "--continue" },
	{ name: "Cline", flag: "--cline" },
	{ name: "Kilo", flag: "--kilo" },
	{ name: "Qwen Code", flag: "--qwen" },
	{ name: "OpenHands", flag: "--openhands" },
	{ name: "Amp", flag: "--amp" },
	{ name: "Hermes", flag: "--hermes" },
	{ name: "Copilot CLI", flag: "--copilot" },
	{ name: "ForgeCode", flag: "--forgecode" },
] as const;

export function SocialProof() {
	return (
		<section
			className="section"
			style={{
				paddingTop: 48,
				paddingBottom: 48,
				borderTop: "1px solid var(--border-subtle)",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<div className="container" style={{ maxWidth: 1280, margin: "0 auto" }}>
				<p
					className="mono text-xs text-center mb-6 uppercase tracking-wider"
					style={{ color: "var(--text-muted)" }}
				>
					Install free endpoints to your favorite AI coding tools
				</p>

				<div className="flex flex-wrap justify-center gap-2">
					{TOOLS.map((tool) => (
						<div
							key={tool.name}
							className="group relative flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all duration-150 cursor-default"
							style={{
								border: "1px solid var(--border-subtle)",
								backgroundColor: "var(--bg-elevated)",
								color: "var(--text-secondary)",
							}}
							onMouseEnter={(e) => {
								const el = e.currentTarget as HTMLElement;
								el.style.borderColor = "var(--border-emphasis)";
								el.style.color = "var(--text-primary)";
							}}
							onMouseLeave={(e) => {
								const el = e.currentTarget as HTMLElement;
								el.style.borderColor = "var(--border-subtle)";
								el.style.color = "var(--text-secondary)";
							}}
						>
							{tool.name}
							{/* Tooltip: flag on hover */}
							<span
								className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-1 rounded text-xs"
								style={{
									backgroundColor: "var(--bg-elevated)",
									border: "1px solid var(--border-default)",
									color: "var(--brand)",
									fontFamily: "monospace",
								}}
							>
								{tool.flag}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
