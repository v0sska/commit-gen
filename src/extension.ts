import * as vscode from 'vscode';
import { Ollama } from 'ollama';

function getGitExtension() {
	const vscodeGit = vscode.extensions.getExtension('vscode.git');
	const gitExtension = vscodeGit?.exports;
	return gitExtension?.getAPI(1);
}

async function getCommitMessage(diff: string): Promise<string> {
	const prompt = `You are an expert developer specializing in creating commit messages.
	Provide one-sentence summary of the user's output following these rules:
	- Simply describe the MAIN GOAL of the changes.
	- Use Conventional Commits`

	const ollama = new Ollama({ host: 'http://localhost:11434' });

	try {
		const response = await ollama.chat({
			model: 'llama3.2',
			messages: [
				{ role: 'system', content: prompt },
				{ role: 'user', content: `Here us the git diff output: ${diff}` },
			],
		});

		return response.message.content.trim();
	} catch (e) {
		throw new Error(`Ollama API error: ${e}`);
	}
}

export async function getSummaryUriDiff(repo: any, uri: string) {
	const diff = await repo.diffIndexWithHEAD(uri);
	return diff;
}

export async function createCommitMessage(repo: any) {
	vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.SourceControl,
			cancellable: false,
			title: 'Creating commit message',
		},
		async () => {
			vscode.commands.executeCommand('workbench.view.scm');
			try {
				repo.inputBox.value = '';

				const ind = await repo.diffIndexWithHEAD();

				if(ind.length === 0) {
					throw new Error('No changes to commit');
				}

				const diff = await getSummaryUriDiff(repo, ind[0].uri.fsPath);

				const commitMessage = await getCommitMessage(diff);
				repo.inputBox.value = commitMessage;
			} catch (e) {
				if (e instanceof Error) {
					vscode.window.showErrorMessage(e.message || 'Unable to create commit message');
				} else {
					vscode.window.showErrorMessage('Unable to create commit message');
				}
			}
		}
	)
}

export function activate(context: vscode.ExtensionContext) {
	const createCommitDisposable = vscode.commands.registerCommand(
		'commit-gen.generateCommit',
		async () => {
			const git = getGitExtension();
			if (!git) {
				vscode.window.showErrorMessage('Unable to load Git extension');
				return;
			}

			const [activeRepo] = git.repositories;
			await createCommitMessage(activeRepo);
		}
	);

	context.subscriptions.push(createCommitDisposable);
}