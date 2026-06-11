ALTER TABLE "token_ledger" DROP CONSTRAINT "token_ledger_agent_check";
ALTER TABLE "token_ledger" ADD CONSTRAINT "token_ledger_agent_check" CHECK (
	agent IS NULL OR agent IN (
		'smoke','frontend','api','workflow','error','expansion',
		'planner','parse_prd','analyze_failures',
		'auth','ui','e2e','scenario-planner'
	)
);
