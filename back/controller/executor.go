package controller

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"os/exec"

	"github.com/mattn/go-shellwords"
	"gopkg.in/gin-gonic/gin.v1"
)

// Executor is controller for executing user code.
type Executor struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}

type Result struct {
	RunTime string
	Output  string
}

func (e *Executor) Handle(c *gin.Context) {
	var request Executor
	c.BindJSON(&request)
	fmt.Println(request.Language)
	var response Result
	response, err := request.Exec(request)
	if err != nil {
		fmt.Println("ERROR!!!: ", err)
	}

	c.String(http.StatusOK, "%s", "ok")
	c.JSON(http.StatusOK, gin.H{
		"run_time": response.RunTime,
		"output":   response.Output,
	})
}

func (e *Executor) Exec(request Executor) (Result, error) {
	var execResult Result
	var (
		filename string
		execCmd  string
	)
	switch request.Language {
	case "ruby":
		filename = "Main.rb"
		execCmd = "ruby" + filename
	case "js":
		filename = "script.js"
		execCmd = "node" + filename
	default:
		execResult.Output = "Invalid language"
		execResult.RunTime = "-ms"
	}

	output, err := createDocker(execCmd)
	if err != nil {
		return execResult, nil
	}

	// get container id from output
	containerID := output[0:12]
	fmt.Println("container ID: ", containerID)

	// コンテナにユーザコードをコピー
	err = copyToContainer(request.Code, filename, containerID)
	if err != nil {
		return execResult, err
	}

	// ユーザコードの実行
	execResult.Output, execResult.RunTime, err = startContainer(containerID)
	if err != nil {
		return execResult, err
	}

	err = removeContainer(containerID)
	if err != nil {
		return execResult, err
	}

	return execResult, nil
}

func createDocker(execCmd string) (string, error) {
	// create docker image
	dockerCmd :=
		`docker create -i ` +
			`--net none ` +
			`--cpuset-cpus 0 ` +
			`--memory 512m --memory-swap 512m ` +
			`--ulimit nproc=10:10 ` +
			`--ulimit fsize=1000000 ` +
			`-w /workspace ` +
			`exec-container ` +
			`/user/bin/time -q -f "%e" -o /time.txt ` +
			`timeout 3 ` +
			`su nobody -s /bin/bash -c "` +
			execCmd +
			`"`

	fmt.Println("exec: ", dockerCmd)
	cmd, err := shellwords.Parse(dockerCmd)
	if err != nil {
		return "", err
	}
	output, err := exec.Command(cmd[0], cmd[1:]...).Output()
	if err != nil {
		return "", err
	}

	return string(output), err
}

func copyToContainer(code string, filename string, containerID string) error {
	exec.Command("rm", "-rf", "/tmp/workspace").Run()
	err := exec.Command("mkdir", "-rf", "/tmp/workspace").Run()
	if err != nil {
		return err
	}
	err = exec.Command("chmod", "777", "/tmp/workspace").Run()
	if err != nil {
		return err
	}
	dockerCmd := `docker cp /tmp/workspace ` + containerID + ":/"
	fmt.Println("exec: ", dockerCmd)
	cmd, err := shellwords.Parse(dockerCmd)
	if err != nil {
		return err
	}
	err = exec.Command(cmd[0], cmd[1:]...).Run()
	if err != nil {
		return err
	}
	return nil
}

func startContainer(containerID string) (string, string, error) {
	dockerCmd := `docker start -i ` + containerID
	fmt.Println("exec: ", dockerCmd)
	cmd, err := shellwords.Parse(dockerCmd)
	if err != nil {
		return "", "", err
	}
	output, err := exec.Command(cmd[0], cmd[1:]...).Output()
	if err != nil {
		return "", "", err
	}
	dockerCmd = `docker cp ` + containerID + `:/time.txt /tmp/time.txt`
	fmt.Println("exec: ", dockerCmd)
	cmd, err = shellwords.Parse(dockerCmd)
	if err != nil {
		return "", "", err
	}
	err = exec.Command(cmd[0], cmd[1:]...).Run()
	if err != nil {
		return "", "", err
	}
	fp, err := os.Open("/tmp/time.txt")
	scanner := bufio.NewScanner(fp)
	var time string
	if scanner.Scan() {
		time = scanner.Text()
	}
	if err := scanner.Err(); err != nil {
		return "", "", err
	}
	return string(output), time, nil
}

func removeContainer(containerID string) error {
	dockerCmd := `docker rm ` + containerID
	fmt.Println("exec: ", dockerCmd)
	cmd, err := shellwords.Parse(dockerCmd)
	if err != nil {
		return err
	}
	err = exec.Command(cmd[0], cmd[1:]...).Run()
	if err != nil {
		return err
	}

	return nil
}
