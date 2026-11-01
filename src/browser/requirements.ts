// Reads the package list for the virtual site-packages from requirements files and
// pyproject.toml. There is no dependency resolution: each named package is installed alone, at
// its `==` pin when it has one, otherwise at the newest release.

/** Whether a workspace-relative path is a pip requirements file. */
export function isRequirementsFile(path: string): boolean {
	const segments = path.split("/");
	const name = segments[segments.length - 1];
	return (
		/^requirements.*\.txt$/.test(name) ||
		(name.endsWith(".txt") && segments[segments.length - 2] === "requirements")
	);
}

/** A PEP 503 normalized project name. */
export function normalizeName(name: string): string {
	return name.toLowerCase().replace(/[-_.]+/g, "-");
}

/** `name` or `name==version` for one PEP 508 requirement, or undefined when not on PyPI. */
export function parseRequirement(text: string): string | undefined {
	const requirement = text.split(";")[0].trim();
	const match = requirement.match(
		/^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\s*(?:\[[^\]]*\])?\s*(.*)$/,
	);
	if (!match) return undefined;
	const [, name, specifier] = match;
	// Direct references (`name @ https://...`) are not PyPI releases.
	if (specifier.startsWith("@")) return undefined;
	const pin = specifier.match(/^==\s*([A-Za-z0-9.+!_-]+)$/);
	return pin ? `${name}==${pin[1]}` : name;
}

export function parseRequirementsTxt(text: string): string[] {
	const requirements: string[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/(^|\s)#.*$/, "").trim();
		// Options (-r, -e, --index-url, ...), local paths, and URLs.
		if (!line || line.startsWith("-") || /^[./]|:\/\//.test(line)) continue;
		const requirement = parseRequirement(line);
		if (requirement) requirements.push(requirement);
	}
	return requirements;
}

/** The `[project] dependencies` array of a pyproject.toml. */
export function parsePyprojectDependencies(text: string): string[] {
	const project = text.match(
		/^\[project\][^\n]*\n([\s\S]*?)(?=^\[|(?![\s\S]))/m,
	);
	if (!project) return [];
	const start = project[1].match(/^dependencies\s*=\s*\[/m);
	if (start?.index === undefined) return [];
	const body = project[1].slice(start.index + start[0].length);
	const requirements: string[] = [];
	// Scan string literals until the array's closing bracket; extras such as
	// "django[argon2]" put brackets inside the strings.
	const token = /\s*(?:#[^\n]*|"([^"]*)"|'([^']*)'|,|(\]))/y;
	let match = token.exec(body);
	while (match && !match[3]) {
		const value = match[1] ?? match[2];
		const requirement =
			value === undefined ? undefined : parseRequirement(value);
		if (requirement) requirements.push(requirement);
		match = token.exec(body);
	}
	return requirements;
}

/**
 * The packages to install: everything the workspace names plus the extra packages setting,
 * one entry per project, later entries winning. Django is skipped because the server bundles
 * its own copy.
 */
export function packageList(
	requirements: string[],
	extraPackages: string[],
): string[] {
	const packages = new Map<string, string>();
	for (const requirement of [
		...requirements,
		...extraPackages.map((pkg) => parseRequirement(pkg)),
	]) {
		if (!requirement) continue;
		const name = normalizeName(requirement.split("==")[0]);
		if (name === "django") continue;
		packages.set(name, requirement);
	}
	return [...packages.values()];
}
