/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

import * as vscode from "vscode";
import { expect } from "chai";

import TestUtil from "../TestUtil";
import Log from "../../Logger";
import ProjectState from "../../codewind/project/ProjectState";
import Commands from "../../constants/Commands";

import { testProjects } from "./Creation.test";
import { LogTypes } from "../../codewind/project/logs/MCLogManager";
import TestConfig from "../TestConfig";

describe(`Project miscellaneous wrapper`, function() {

    before(`should use the precreated test projects`, function() {
        expect(testProjects, `No test projects were found`).to.exist.and.have.length.greaterThan(0);
    });

    // We nest the dynamically generated tests in a before() so they don't execute too soon
    // https://stackoverflow.com/a/54681623
    before(async function() {
        describe(`Project miscellaneous`, function() {

            const buildTimeout =    TestConfig.isJenkins() ? TestUtil.ms(5, "min") : TestUtil.ms(2, "min");
            const buildSlow =       TestConfig.isJenkins() ? TestUtil.ms(2, "min") : TestUtil.ms(1, "min");

            testProjects.forEach((project) => {

                if (!project.type.isAppsody) {
                    it(`${project.name} should build manually`, async function() {
                        this.timeout(buildTimeout);
                        this.slow(buildSlow);

                        await vscode.commands.executeCommand(Commands.REQUEST_BUILD, project);

                        await TestUtil.waitForCondition(this, {
                            label: `Waiting for ${project.name} to start a build`,
                            condition: () => project.state.isBuilding,
                        });

                        await TestUtil.waitForCondition(this, {
                            label: `Waiting for ${project.name} to have its build succeed`,
                            condition: () => project.state.buildState === ProjectState.BuildStates.BUILD_SUCCESS,
                        }, {
                            label: `${project.name} manual build failed`,
                            condition: () => project.state.buildState === ProjectState.BuildStates.BUILD_FAILED,
                        });
                    });
                }
                else {
                    // Appsody projects don't use the Building states.
                    it(`${project.name} should build manually (Appsody)`, async function() {
                        this.timeout(buildTimeout);
                        this.slow(buildSlow);

                        Log.t("Requesting an appsody build for " + project.name);
                        await vscode.commands.executeCommand(Commands.REQUEST_BUILD, project);

                        await TestUtil.waitForCondition(this, {
                            label: `Waiting for ${project.name} to start a build`,
                            condition: () => project.state.isStarting,
                        });
                    });
                }

                it(`${project.name} should re-start after the build`, async function() {
                    this.timeout(buildTimeout);
                    this.slow(buildSlow);
                    await TestUtil.waitForStarted(this, project);
                });

                it(`${project.name} should have log files`, async function() {
                    this.timeout(TestUtil.ms(2, "min"));
                    this.slow(TestUtil.ms(1, "min"));

                    // Extension projects have one log, codewind projects should have a build log and an app log (if the project has started)
                    await TestUtil.waitForStarted(this, project);

                    // appsody projects don't have a build log
                    if (!project.type.isAppsody) {
                        const buildLog = project.logManager.logs.filter((log) => log.type === LogTypes.BUILD);
                        expect(buildLog, `No build log was found`).to.exist;
                    }
                    const appLog = project.logManager.logs.filter((log) => log.type === LogTypes.APP);
                    expect(appLog, `No app log was found`).to.exist;

                    Log.t(`${project.name} has ${project.logManager.logs.length} log files`);
                });

                it(`${project.name} should be able to open a container shell`, async function() {
                    this.timeout(TestUtil.ms(1, "min"));
                    this.slow(TestUtil.ms(30, "sec"));

                    // close open terminals
                    vscode.window.terminals.forEach((terminal) => terminal.dispose());

                    await vscode.commands.executeCommand(Commands.CONTAINER_SHELL, project);
                    Log.t(`Waiting before testing container shell terminal...`)
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    const activeTerminal = vscode.window.activeTerminal;

                    expect(activeTerminal, `No active terminal was found`).to.exist;
                    Log.t(`Active terminal is ${activeTerminal?.name}`)
                    expect(activeTerminal?.name, `Active terminal name didn't include project name`).to.include(project.name);

                    activeTerminal?.dispose();
                });
            });
        });
    });

    it(`stub`, function() { /* stub https://stackoverflow.com/a/54681623 */ } );
});
