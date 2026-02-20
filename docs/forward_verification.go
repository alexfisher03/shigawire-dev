package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const targetService = "http://localhost:8080"
const shigawireBackend = "http://localhost:8083"
const shigawireProxy = "http://localhost:9090"
const projectTestName = "proxy-test-project"

type Result struct {
	Name       string
	Method     string
	Endpoint   string
	StatusCode int
	Body       string
	Success    bool
}

type Project struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Session struct {
	ID string `json:"id"`
}

func printResult(r Result) {
	status := "✅ PASS"
	if !r.Success {
		status = "❌ FAIL"
	}
	fmt.Printf("\n%s [%s] %s %s\n", status, r.Method, r.Endpoint, r.Name)
	fmt.Printf("   Status: %d\n", r.StatusCode)
	fmt.Printf("   Body:   %s\n", r.Body)
}

func doRequest(name, method, url string, body io.Reader, headers map[string]string) Result {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return Result{Name: name, Method: method, Endpoint: url, StatusCode: 0, Body: err.Error(), Success: false}
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return Result{Name: name, Method: method, Endpoint: url, StatusCode: 0, Body: err.Error(), Success: false}
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return Result{Name: name, Method: method, Endpoint: url, StatusCode: resp.StatusCode, Body: err.Error(), Success: false}
	}
	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	return Result{Name: name, Method: method, Endpoint: url, StatusCode: resp.StatusCode, Body: string(respBody), Success: success}
}

func getProjectIDByName(resTargetGet Result, name string) (string, bool) {
	var projects []Project
	json.Unmarshal([]byte(resTargetGet.Body), &projects)

	var projectID string
	for _, p := range projects {
		if p.Name == name {
			projectID = p.ID
			break
		}
	}
	return projectID, projectID != ""
}

func getSessionID(resTargetGet Result) string {
	var session Session
	json.Unmarshal([]byte(resTargetGet.Body), &session)
	return session.ID
}

func main() {
	fmt.Println("Starting Verification Tests...")

	resTargetGet := doRequest("Get Health", "GET", targetService+"/api/v1/health", nil, nil)
	ts := time.Now().Unix()
	accountBody, _ := json.Marshal(map[string]string{
		"username": fmt.Sprintf("littleguy%d", ts),
		"email":    fmt.Sprintf("littleguy%d@aperature.com", ts),
		"password": "secret123",
	})
	resTargetPost := doRequest("Create User", "POST", targetService+"/api/v1/users",
		bytes.NewReader(accountBody), map[string]string{"Content-Type": "application/json"})
	printResult(resTargetGet)
	printResult(resTargetPost)

	// time for shiga
	projects := doRequest("List Projects", "GET", shigawireBackend+"/api/v1/projects", nil, nil)
	printResult(projects)
	projectID, found := getProjectIDByName(projects, projectTestName)
	if !found {
		projectBody, _ := json.Marshal(map[string]string{
			"name": projectTestName,
		})
		doRequest("Create Project", "POST", shigawireBackend+"/api/v1/projects", bytes.NewReader(projectBody), map[string]string{"Content-Type": "application/json"})
	}
	sessionBody, _ := json.Marshal(map[string]string{
		"name": "Proxy Test Session",
	})
	session := doRequest("Create Session", "POST", shigawireBackend+"/api/v1/projects/"+projectID+"/sessions", bytes.NewReader(sessionBody), map[string]string{"Content-Type": "application/json"})
	printResult(session)
	resShigawireStart := doRequest("Proxy Start", "POST", shigawireBackend+"/api/v1/projects/"+projectID+"/sessions/"+getSessionID(session)+"/record/start", nil, nil)
	printResult(resShigawireStart)

	resShigawireProxyGet := doRequest("Get Health", "GET", shigawireProxy+"/api/v1/health", nil, nil)
	printResult(resShigawireProxyGet)
	if resShigawireProxyGet == resTargetGet {
		fmt.Println("✅ Proxy GET request matches target service response")
	}

	fmt.Println("\nVerification Tests Completed.")
}
