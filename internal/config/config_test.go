package config

import "testing"

func TestExtractSubdomain(t *testing.T) {
	tests := []struct {
		name         string
		host         string
		proxyDomains []string
		want         string
	}{
		{
			name:         "localhost_with_port",
			host:         "openai.localhost:8080",
			proxyDomains: []string{"localhost"},
			want:         "openai",
		},
		{
			name:         "case_insensitive",
			host:         "OpenAI.LocalHost",
			proxyDomains: []string{"LOCALHOST"},
			want:         "openai",
		},
		{
			name:         "custom_domain",
			host:         "gemini.prismcat.example.com",
			proxyDomains: []string{"prismcat.example.com"},
			want:         "gemini",
		},
		{
			name:         "multi_label_rejected",
			host:         "a.b.example.com",
			proxyDomains: []string{"example.com"},
			want:         "",
		},
		{
			name:         "no_subdomain",
			host:         "example.com",
			proxyDomains: []string{"example.com"},
			want:         "",
		},
		{
			name:         "nil_domains_default_localhost",
			host:         "openai.localhost",
			proxyDomains: nil,
			want:         "openai",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractSubdomain(tt.host, tt.proxyDomains); got != tt.want {
				t.Fatalf("ExtractSubdomain(%q, %v) = %q, want %q", tt.host, tt.proxyDomains, got, tt.want)
			}
		})
	}
}

func TestNormalizePathRoutingPrefix(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "default_empty", in: "", want: "/_proxy"},
		{name: "trim_spaces", in: "  /edge/ ", want: "/edge"},
		{name: "missing_leading_slash", in: "proxy", want: "/proxy"},
		{name: "windows_separators", in: "\\edge\\v1\\", want: "/edge/v1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizePathRoutingPrefix(tt.in); got != tt.want {
				t.Fatalf("NormalizePathRoutingPrefix(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestExtractPathUpstream(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		prefix      string
		wantName    string
		wantPath    string
		wantMatched bool
	}{
		{name: "basic", path: "/_proxy/openai/v1/chat/completions", prefix: "/_proxy", wantName: "openai", wantPath: "/v1/chat/completions", wantMatched: true},
		{name: "custom_prefix", path: "/edge/gemini/models", prefix: "edge", wantName: "gemini", wantPath: "/models", wantMatched: true},
		{name: "root_forward", path: "/_proxy/openai", prefix: "/_proxy", wantName: "openai", wantPath: "/", wantMatched: true},
		{name: "empty_upstream", path: "/_proxy/", prefix: "/_proxy", wantName: "", wantPath: "", wantMatched: false},
		{name: "dots_rejected", path: "/_proxy/openai.v2/test", prefix: "/_proxy", wantName: "", wantPath: "", wantMatched: false},
		{name: "different_prefix", path: "/api/openai/test", prefix: "/_proxy", wantName: "", wantPath: "", wantMatched: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotName, gotPath, gotMatched := ExtractPathUpstream(tt.path, tt.prefix)
			if gotName != tt.wantName || gotPath != tt.wantPath || gotMatched != tt.wantMatched {
				t.Fatalf(
					"ExtractPathUpstream(%q, %q) = (%q, %q, %v), want (%q, %q, %v)",
					tt.path, tt.prefix, gotName, gotPath, gotMatched, tt.wantName, tt.wantPath, tt.wantMatched,
				)
			}
		})
	}
}
